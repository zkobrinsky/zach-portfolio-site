// Fills the archived page's ad slots the way Complex's demo loader did, then lands on the ad.
(function () {
  var DEMOS = {
    swagger: { top: "swagger.desktop.3x3", toolbar: "swagger.desktop.7x7", inline: "swagger.desktop.100x100" },
    dell: { top: "dell.desktop.3x3", toolbar: "dell.desktop.7x7", inline: "dell.mobile.content" },
    timberland: { top: "timberland.desktop.3x3", toolbar: "timberland.desktop.7x7", inline: "timberland.mobile.content" },
    "banana-republic": { top: "banana.desktop.3x3" },
  };
  var demo = DEMOS[location.pathname.replace(/\/+$/, "").split("/").pop()];
  if (!demo) return;

  // the creatives ask the host page to pause and resume ad refreshes; nothing refreshes here
  window.CMNHELPERS = { timeBasedRefresh: { init: function () {}, stop: function () {} } };

  // phones don't get the header slot or the toolbar on the live site
  var phone = window.innerWidth < 768 && !!demo.inline;

  function mount(slotId, creative, width) {
    var slot = document.getElementById(slotId);
    if (!slot) return;
    // the creatives read frameElement.parentNode.parentNode, so this nesting matters
    var holder = document.createElement("div");
    holder.style.border = "0pt none";
    var frame = document.createElement("iframe");
    frame.id = slotId + "_iframe";
    frame.width = width;
    frame.height = width;
    frame.scrolling = "no";
    frame.frameBorder = "0";
    frame.style.cssText = "border:0;vertical-align:bottom";
    frame.setAttribute("allowfullscreen", "");
    holder.appendChild(frame);
    slot.appendChild(holder);
    fetch("/archive/complex-ads/creatives/" + creative + ".html")
      .then(function (r) {
        return r.text();
      })
      .then(function (html) {
        var doc = frame.contentWindow.document;
        doc.open("text/html", "replace");
        doc.write('<html><head><script>let inDapIF = true;<\/script></head><body leftmargin="0" topmargin="0"><div>' + html + "</div></body></html>");
        doc.close();
      });
  }

  if (phone) {
    mount("feed_suitcase_1", demo.inline, 100);
    mount("feed_suitcase_2", demo.inline, 100);
    mount("feed_suitcase_3", demo.inline, 100);
  } else {
    mount("catalyst_ad_top", demo.top, 1020);
    if (demo.inline) {
      mount("feed_suitcase_1", demo.inline, 100);
      mount("feed_suitcase_2", demo.inline, 100);
      mount("feed_suitcase_3", demo.inline, 100);
    }
    if (demo.toolbar) {
      mount("catalyst_ad_toolbar", demo.toolbar, 320);
      var wrap = document.getElementById("cmn_toolbar_wrap");
      if (wrap) wrap.style.display = "flex";
      var close = document.getElementById("cmn_toolbar_toggle");
      if (close && wrap) {
        close.addEventListener("click", function () {
          wrap.style.display = "none";
          var panel = document.getElementById("mwd_tb_panel_wrap");
          if (panel) panel.classList.remove("shown");
        });
      }
    }
  }

  // Land on the ad. Images and creatives keep shifting the page for a few seconds,
  // so keep correcting until the visitor takes over.
  var target = document.getElementById(phone ? "feed_suitcase_1" : "catalyst_ad_top");
  if (!target) return;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  var settled = false;
  function settle() {
    settled = true;
  }
  ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (name) {
    window.addEventListener(name, settle, { passive: true, once: true });
  });
  function land() {
    if (settled) return;
    var header = document.querySelector(".site-header");
    var offset = header ? header.getBoundingClientRect().height : 0;
    window.scrollTo(0, Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset));
  }
  var started = Date.now();
  (function tick() {
    land();
    if (!settled && Date.now() - started < 5000) setTimeout(tick, 200);
  })();
})();
