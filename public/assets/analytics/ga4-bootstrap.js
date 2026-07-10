(function () {
  var script = document.currentScript;
  var measurementId = script && script.getAttribute("data-ga4-measurement-id");

  if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) {
    window.__WAKILISHA_GA4_READY__ = false;
    return;
  }

  window.__WAKILISHA_GA4_ID__ = measurementId;
  window.__WAKILISHA_GA4_READY__ = true;
  window.dataLayer = window.dataLayer || [];

  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false
  });
})();
