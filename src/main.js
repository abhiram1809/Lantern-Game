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
import { Prisoner } from './story/Prisoner.js';
import { Probation } from './story/Probation.js';
import { Roam } from './story/Roam.js';
import { Save, CorpsSave, CoastSave, PrisonerSave, ProbationSave, ExileSave, PARTS, partOf, takeResume, latestCheckpoint } from './engine/Save.js';

const POSTERS = ['airforce', 'jets', 'testpilot', 'flightseat', 'sidewall', 'squadron', 'whitejet'];

async function boot() {
  const engine = new Engine(document.getElementById('app'));
  const input = new Input(engine.renderer.domElement);
  const audio = new AudioBank();
  const voice = new Voice();
  voice.audio = audio; // clips play through the game's own mix
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
  story = new ({ corps: Corps, coast: Coast, prisoner: Prisoner, probation: Probation, exile: Roam }[part] ?? Story)({ engine, ui, input, audio, voice, assets: { characters, posters } });
  try {
    await story.run(id);
  } catch (err) {
    // a step that throws would leave Hal in a scene that never moves on: say so, and offer the
    // checkpoint again (it rebuilds the scene from scratch)
    console.error(err);
    try { story.takeControl(); } catch { /* the card still shows */ }
    await ui.screen({ kicker: 'Something went wrong', title: 'THE STORY STOPPED', body: `An error stopped this chapter (${err.message}). Restarting the checkpoint usually gets past it.`, buttons: ['Restart checkpoint'] });
    story.save.resumeAfterReload(story.checkpointId);
  }
}

// Title card: Begin, or Continue (the checkpoint played last, in whichever part) / Parts / Chapters
// / New game once there's a save; Part Two once Part One is finished, Part Three once Part Two is, and
// so on to Part Six. A restart from the pause menu reloads the page and lands here with the
// checkpoint to resume. Resolves with { part, id }.
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
    const save = Save.load(), corps = CorpsSave.load(), coast = CoastSave.load(), prisoner = PrisonerSave.load(), probation = ProbationSave.load(), exile = ExileSave.load();
    // Part One's end card went on to Part Two before `free` was saved, so those saves still read
    // "The ring's power" (the user, 2026-11-18: "stuck at the ring's power chapter"). Part One is done.
    if (save.checkpoint === 'powers' && corps.reached.length && !save.reached.includes('free')) Save.update((d) => { d.checkpoint = 'free'; d.reached.push('free'); });
    const parts = [
      Save,
      ...(save.reached.includes('free') || corps.reached.length ? [CorpsSave] : []),
      ...(corps.reached.includes('homeward') || coast.reached.length ? [CoastSave] : []),
      ...(coast.reached.includes('grave') || prisoner.reached.length ? [PrisonerSave] : []),
      ...(prisoner.reached.includes('trial') || probation.reached.length ? [ProbationSave] : []),
      ...(probation.reached.includes('report') || exile.reached.length ? [ExileSave] : []),
    ];
    const short = (p) => p.label.split(' · ')[0], last = short(parts.at(-1)).replace('Part ', '');
    const latest = latestCheckpoint();
    const buttons = latest ? [{ label: 'Continue', sub: `${short(latest.save)} · ${latest.save.info(latest.id).label}` }] : ['Begin'];
    if (parts.length > 1) buttons.push('Parts');
    if (latest || save.reached.length > 1) buttons.push('Chapters');
    if (latest) buttons.push('New game');
    const pick = await ui.screen({
      emblem: true,
      kicker: parts.length === 1 ? 'Part One' : parts.length === 2 ? 'Parts One and Two' : `Parts One to ${last}`,
      title: 'GREEN LANTERN',
      subtitle: parts.map((p) => p.label.split(' · ')[1]).join(' · '),
      body: 'Test pilot Hal Jordan is coming home after a long day. Tonight, something in the sky has other plans.',
      small: 'Headphones recommended &nbsp;·&nbsp; WASD move &nbsp;·&nbsp; Mouse look &nbsp;·&nbsp; E interact &nbsp;·&nbsp; L lantern &nbsp;·&nbsp; Space advance &nbsp;·&nbsp; V voices &nbsp;·&nbsp; Esc pause',
      buttons,
      stack: buttons.length > 2,
    });
    const label = typeof buttons[pick] === 'string' ? buttons[pick] : buttons[pick].label;
    if (label === 'Continue') return { part: latest.part, id: latest.id };
    if (label === 'Begin' || label === 'New game') { Save.newGame(); return { part: 'awakening', id: 'home' }; }
    if (label === 'Parts') {
      const data = parts.map((p) => p.load());
      const p = await ui.screen({
        kicker: 'Parts', title: 'CHOOSE A PART', stack: true,
        buttons: [...parts.map((x, i) => ({ label: x.label.replace(' · ', ': '), sub: data[i].checkpoint ? `Continue · ${x.info(data[i].checkpoint).label}` : x.info(x.first).label })), 'Back'],
      });
      if (p === parts.length) continue;
      return { part: parts[p].part, id: data[p].checkpoint ?? parts[p].first };
    }
    let chapters = Save;
    if (parts.length > 1) {
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
  const label = document.querySelector('#loading .label'); // gone once the title is up
  if (label) label.textContent = `Failed to start: ${err.message}`;
});
