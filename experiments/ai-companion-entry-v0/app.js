(function initializeCompanionEntry() {
  "use strict";

  const copy = window.TABI_MATE_COPY;
  const form = document.querySelector("#companion-form");
  const input = document.querySelector("#companion-input");
  const error = document.querySelector("#input-error");
  const log = document.querySelector("#conversation-log");

  document.querySelectorAll("[data-copy]").forEach((node) => {
    const key = node.dataset.copy;
    if (typeof copy[key] === "string") node.textContent = copy[key];
  });

  document.querySelectorAll("[data-copy-placeholder]").forEach((node) => {
    const key = node.dataset.copyPlaceholder;
    if (typeof copy[key] === "string") node.setAttribute("placeholder", copy[key]);
  });

  function appendMessage(text, kind) {
    const message = document.createElement("p");
    message.className = `message message--${kind}`;
    message.textContent = text;
    log.append(message);
    message.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function submitMessage() {
    const value = input.value.trim();
    if (!value) {
      error.textContent = copy.emptyError;
      error.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }

    error.hidden = true;
    input.removeAttribute("aria-invalid");
    appendMessage(value, "user");
    appendMessage(copy.experimentReply, "system");
    input.value = "";
    input.focus({ preventScroll: true });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitMessage();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submitMessage();
    }
  });
})();
