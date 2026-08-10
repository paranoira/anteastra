(() => {
  const media = window.matchMedia("(max-width: 760px)");

  function placeLayoutSettingsButton() {
    const button = document.getElementById("layout-settings-button");
    const mobileSlot = document.getElementById("mobile-layout-settings-slot");
    const desktopSlot = document.getElementById("desktop-layout-settings-slot");
    const target = media.matches ? mobileSlot : desktopSlot;

    if (!button || !target || button.parentElement === target) return;
    target.append(button);
    mobileSlot?.setAttribute("aria-hidden", media.matches ? "false" : "true");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", placeLayoutSettingsButton, { once: true });
  } else {
    placeLayoutSettingsButton();
  }

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", placeLayoutSettingsButton);
  } else {
    media.addListener(placeLayoutSettingsButton);
  }
})();
