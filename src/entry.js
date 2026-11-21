import('./main.js').then(({ boot }) => boot()).catch((error) => {
  console.error(error);
  const loading = document.querySelector('#loading');
  loading.style.display = '';
  loading.classList.remove('done');
  loading.classList.add('failed');
  loading.querySelector('.label').textContent = 'The game could not start.';
  loading.querySelector('.detail').textContent = /WebGL/i.test(error.message)
    ? 'This game requires a browser with WebGL 2 support.'
    : 'Check your connection and try again.';
  const retry = loading.querySelector('.retry');
  retry.hidden = false;
  retry.addEventListener('click', () => location.reload());
  retry.focus();
});
