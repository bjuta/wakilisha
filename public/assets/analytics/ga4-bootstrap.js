(function () {
  var script = document.currentScript;
  var measurementId =
    script && script.getAttribute("data-ga4-measurement-id");

  var productionHosts = {
    "wakilisha.africa": true,
    "www.wakilisha.africa": true
  };

  if (
    !measurementId ||
    !/^G-[A-Z0-9]+$/i.test(measurementId) ||
    !productionHosts[window.location.hostname]
  ) {
    window.__WAKILISHA_GA4_READY__ = false;
    return;
  }

  window.__WAKILISHA_GA4_ID__ = measurementId;
  window.__WAKILISHA_GA4_READY__ = false;
  window.dataLayer = window.dataLayer || [];

  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false
  });

  var loading = false;

  function loadGa4() {
    if (window.location.pathname.indexOf("/admin") === 0) {
      return;
    }

    if (
      loading ||
      document.querySelector(
        'script[data-wakilisha-ga4-loader="true"]'
      )
    ) {
      return;
    }

    loading = true;

    var loader = document.createElement("script");
    loader.async = true;
    loader.dataset.wakilishaGa4Loader = "true";
    loader.src =
      "https://www.googletagmanager.com/gtag/js?id=" +
      encodeURIComponent(measurementId);

    loader.onload = function () {
      window.__WAKILISHA_GA4_READY__ = true;
    };

    loader.onerror = function () {
      loading = false;
      window.__WAKILISHA_GA4_READY__ = false;
    };

    document.head.appendChild(loader);
  }

  window.__WAKILISHA_LOAD_GA4__ = loadGa4;
  loadGa4();
})();
