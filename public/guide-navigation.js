// These remain ordinary anchor links; selection describes the URL's location.
const guideNavigation = document.querySelector('.guide-contents');
if (guideNavigation) {
 const updateCurrentLocation = () => {
  for (const link of guideNavigation.querySelectorAll('a[href^="#"]')) {
   if (link.hash === location.hash) link.setAttribute('aria-current', 'location');
   else link.removeAttribute('aria-current');
  }
 };
 updateCurrentLocation();
 window.addEventListener('hashchange', updateCurrentLocation);
}
