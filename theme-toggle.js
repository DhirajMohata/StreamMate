// theme-toggle.js

document.addEventListener('DOMContentLoaded', function () {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const appBody = document.getElementById('app-body');
  const themeIcon = document.getElementById('theme-icon');

  // Check for saved user preference, if any
  const userThemePreference = localStorage.getItem('theme');

  if (userThemePreference === 'light') {
    enableLightMode();
  } else {
    enableDarkMode();
  }

  // Toggle the theme when clicking the button
  themeToggleBtn.addEventListener('click', () => {
    if (appBody.classList.contains('dark')) {
      enableLightMode();
    } else {
      enableDarkMode();
    }
  });

  function enableDarkMode() {
    appBody.classList.add('dark');
    // Update icon to Moon for dark mode
    themeIcon.innerHTML = `
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m8.66-4.34l-.71.71m-13.9 0l-.71-.71m16.72-10.97l-.71-.71M4.93 4.93l-.71.71m12.02 12.02a9 9 0 11-12.73-12.73 9 9 0 0112.73 12.73z" />
    `;
    localStorage.setItem('theme', 'dark');
  }

  function enableLightMode() {
    appBody.classList.remove('dark');
    // Update icon to Sun for light mode
    themeIcon.innerHTML = `
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a9 9 0 110 18 9 9 0 010-18z" />
    `;
    localStorage.setItem('theme', 'light');
  }
});
