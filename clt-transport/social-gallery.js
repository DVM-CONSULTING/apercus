(() => {
  const dialog = document.querySelector('#photo-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const image = dialog.querySelector('img');
  const title = dialog.querySelector('h2');
  const source = dialog.querySelector('#photo-dialog-source');
  document.querySelectorAll('[data-photo]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      image.src = link.dataset.photo;
      image.alt = link.querySelector('img').alt;
      title.textContent = link.dataset.caption;
      source.href = link.href;
      dialog.showModal();
    });
  });
  dialog.addEventListener('click', event => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
  });
})();
