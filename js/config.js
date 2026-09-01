// Small localStorage-backed helpers. Everything here is per-device only --
// nothing is sent anywhere; this app never talks to a server.
const NCR_STORAGE_KEYS = {
  recipients: "ncr.recipients.default",
};

const NcrRecipients = {
  getDefault() {
    try {
      const raw = localStorage.getItem(NCR_STORAGE_KEYS.recipients);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
  saveDefault(list) {
    localStorage.setItem(NCR_STORAGE_KEYS.recipients, JSON.stringify(list));
  },
};
