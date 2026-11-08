/* Поведение страницы: открыто ли сейчас, коробка с жемчугом на прокрутке, появление блоков, форма, панель на телефоне. */
(function () {
  var TEL = '<a href="tel:+79087916891">+7 (908) 791-68-91</a> или напишите в <a href="https://wa.me/79087916891" target="_blank" rel="noopener">WhatsApp</a>';
  var FORM_ENDPOINT = ''; /* {{адрес приёма заявок}} */
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  var hero = $('hero'), bar = $('bar'), contacts = $('contacts');

  /* Время в Омске (UTC+6): Пн–Чт 8:00–22:00, Пт–Вс 8:00–23:00 */
  var d = new Date(Date.now() + 6 * 3600000), h = d.getUTCHours(), day = d.getUTCDay();
  var to = day === 5 || day === 6 || day === 0 ? 23 : 22, open = h >= 8 && h < to, now = $('now');
  now.textContent = open ? 'Сейчас открыто' : (h < 8 ? 'Откроемся в 8:00' : 'Завтра с 8:00');
  now.classList.toggle('off', !open);
  now.hidden = false;

  function update() {
    var H = innerHeight, hr = hero.getBoundingClientRect(), cr = contacts.getBoundingClientRect();
    if (window.PB) { PB.live(hr.bottom > 0); PB.scroll(-hr.top / Math.max(1, hr.height)); }
    bar.classList.toggle('on', hr.bottom < H * .3 && cr.top > H * .6);
  }
  var ticking = false;
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }, { passive: true });
  addEventListener('resize', update);
  update();

  if (!reduce && 'IntersectionObserver' in window) {
    var rise = document.querySelectorAll('.sec h2,.sec .sub,.w,.mag figure,.sal li,.deliv .pull,.terms li,.score,.rev,.maplink,.form');
    rise.forEach(function (el) { el.classList.add('rise'); });
    var seen = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rise.forEach(function (el) { seen.observe(el); });
  }

  var form = $('form'), msg = $('formMsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ph = form.elements.phone, ok = ph.value.replace(/\D/g, '').length >= 10;
    ph.classList.toggle('invalid', !ok);
    if (!ok) { msg.textContent = 'Укажите телефон, чтобы мы могли связаться.'; ph.focus(); return; }
    if (!FORM_ENDPOINT) { msg.innerHTML = 'Заявки с сайта пока не подключены, поэтому ваш номер не отправлен. Позвоните: ' + TEL; return; }
    fetch(FORM_ENDPOINT, { method: 'POST', body: new FormData(form) })
      .then(function (r) { if (!r.ok) throw 0; msg.textContent = 'Заявка принята, свяжемся с вами.'; form.reset(); })
      .catch(function () { msg.innerHTML = 'Заявка не отправилась. Позвоните: ' + TEL; });
  });
})();
