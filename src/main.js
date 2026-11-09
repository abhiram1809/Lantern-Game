import * as THREE from 'three';
import { Engine } from './engine/Engine.js';
import { Input } from './engine/Input.js';
import { AudioBank } from './engine/Audio.js';
import { Voice } from './engine/Voice.js';
import { initPhysics } from './engine/Physics.js';
import { tick } from './engine/Time.js';
import { UI } from './ui/UI.js';
import { loadCharacters } from './characters/Characters.js';
import { Story, chapterMenu } from './story/Story.js';
import { Corps } from './story/Corps.js';
import { Coast } from './story/Coast.js';
import { Save, CorpsSave, CoastSave, PARTS, partOf, takeResume } from './engine/Save.js';

const POSTERS = ['airforce', 'jets', 'testpilot', 'flightseat', 'sidewall', 'squadron', 'whitejet'];

async function boot() {
  const engine = new Engine(document.getElementById('app'));
  const input = new Input(engine.renderer.domElement);
  const audio = new AudioBank();
  const voice = new Voice();
  const ui = new UI({ input, audio, voice });

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => ui.loading(loaded / total);
  const texLoader = new THREE.TextureLoader(manager);
  const [characters, posterTex] = await Promise.all([
    loadCharacters(manager),
    Promise.all(POSTERS.map((n) => texLoader.loadAsync(`/textures/posters/${n}.jpg`))),
    initPhysics(),
    document.fonts?.ready,
  ]);
  const posters = Object.fromEntries(POSTERS.map((n, i) => {
    posterTex[i].colorSpace = THREE.SRGBColorSpace;
    posterTex[i].anisotropy = 8;
    return [n, posterTex[i]];
  }));

  // The story object depends on the part chosen at the title, so it's made after the title card.
  let story = null;
  window.__game = {
    engine, ui, input,
    get story() { return story; },
    // Debug: step the game and save a capture of the canvas (dev server only).
    async shot(name, seconds = 0) {
      if (seconds > 0) await engine.advance(seconds);
      else engine.frame(0);
      const url = engine.renderer.domElement.toDataURL('image/png');
      await fetch(`/__shot?name=${name}`, { method: 'POST', body: url });
      return name;
    },
  };
  engine.start((dt, t, real) => {
    tick(dt);
    story?.update(dt, t, real);
    input.endFrame();
  });
  ui.loaded();

  const { part, id } = await titleFlow(ui);
  audio.init();
  story = new ({ corps: Corps, coast: Coast }[part] ?? Story)({ engine, ui, input, audio, voice, assets: { characters, posters } });
  await story.run(id);
}

// Title card: Begin, or Continue / New game / Chapters once there's a save; Part Two once Part One
// is finished, Part Three once Part Two is. A restart from the pause menu reloads the page and lands
// here with the checkpoint to resume. Resolves with { part, id }.
async function titleFlow(ui) {
  const resume = takeResume();
  const debug = location.hash.slice(1);
  if (resume || debug) {
    const r = resume ?? { part: partOf(debug), id: debug };
    const save = PARTS[r.part];
    await ui.screen({ kicker: save.label, title: save.info(r.id).label.toUpperCase(), subtitle: 'Checkpoint', buttons: ['Continue'] });
    return r;
  }
  for (;;) {
    const save = Save.load(), corps = CorpsSave.load(), coast = CoastSave.load();
    const has = save.checkpoint && save.checkpoint !== 'home';
    const partTwo = save.reached.includes('free') || corps.reached.length > 0;
    const partThree = corps.reached.includes('homeward') || coast.reached.length > 0;
    const buttons = has ? [{ label: 'Continue', sub: Save.info(save.checkpoint).label }, 'New game'] : ['Begin'];
    if (partTwo) buttons.push({ label: 'Part Two: The Corps', sub: corps.checkpoint ? `Continue · ${CorpsSave.info(corps.checkpoint).label}` : 'The summons' });
    if (partThree) buttons.push({ label: 'Part Three: Coast City', sub: coast.checkpoint ? `Continue · ${CoastSave.info(coast.checkpoint).label}` : 'The morning after' });
    if (has || partTwo || save.reached.length > 1) buttons.push('Chapters');
    const pick = await ui.screen({
      emblem: true,
      kicker: partThree ? 'Parts One to Three' : partTwo ? 'Parts One and Two' : 'Part One',
      title: 'GREEN LANTERN',
      subtitle: partThree ? 'Awakening · The Corps · Coast City' : partTwo ? 'Awakening · The Corps' : 'Awakening',
      body: 'Test pilot Hal Jordan is coming home after a long day. Tonight, something in the sky has other plans.',
      small: 'Headphones recommended &nbsp;·&nbsp; WASD move &nbsp;·&nbsp; Mouse look &nbsp;·&nbsp; E interact &nbsp;·&nbsp; L lantern &nbsp;·&nbsp; Space advance &nbsp;·&nbsp; V voices &nbsp;·&nbsp; Esc pause',
      buttons,
      stack: buttons.length > 2,
    });
    const label = typeof buttons[pick] === 'string' ? buttons[pick] : buttons[pick].label;
    if (label === 'Continue') return { part: 'awakening', id: save.checkpoint };
    if (label === 'Begin' || label === 'New game') { Save.newGame(); return { part: 'awakening', id: 'home' }; }
    if (label.startsWith('Part Two')) return { part: 'corps', id: corps.checkpoint ?? CorpsSave.first };
    if (label.startsWith('Part Three')) return { part: 'coast', id: coast.checkpoint ?? CoastSave.first };
    let chapters = Save;
    if (partTwo) {
      const parts = [Save, CorpsSave, ...(partThree ? [CoastSave] : [])];
      const p = await ui.screen({ kicker: 'Chapters', title: 'CHOOSE A PART', stack: true, buttons: [...parts.map((x) => x.label.replace(' · ', ': ')), 'Back'] });
      if (p === parts.length) continue;
      chapters = parts[p];
    }
    const id = await chapterMenu(ui.screen.bind(ui), chapters);
    if (id) return { part: chapters.part, id };
  }
}

boot().catch((err) => {
  console.error(err);
  document.querySelector('#loading .label').textContent = `Failed to start: ${err.message}`;
});
