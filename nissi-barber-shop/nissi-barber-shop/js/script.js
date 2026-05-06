const navbar = document.getElementById('mainNavbar');
const navLinks = document.querySelectorAll('.nav-link');
const bookingForm = document.getElementById('bookingForm');
const formAlert = document.getElementById('formAlert');
const year = document.getElementById('year');

window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    navbar.classList.add('navbar-scrolled');
  } else {
    navbar.classList.remove('navbar-scrolled');
  }
});

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    const navbarCollapse = document.querySelector('.navbar-collapse');
    if (navbarCollapse.classList.contains('show')) {
      new bootstrap.Collapse(navbarCollapse).hide();
    }
  });
});

bookingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  formAlert.classList.remove('d-none');
  bookingForm.reset();

  setTimeout(() => {
    formAlert.classList.add('d-none');
  }, 4500);
});

year.textContent = new Date().getFullYear();
