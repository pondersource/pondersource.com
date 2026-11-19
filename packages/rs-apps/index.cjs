/* Shared connection UI and module adapters for PonderSource's rs.js apps. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PonderSourceStorage = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function expose(client, methods) {
    return Object.fromEntries(methods.map(name => [name, client[name].bind(client)]));
  }
  function scopedModule(name, methods, types = {}) {
    return { name, builder(client) {
      for (const [type, schema] of Object.entries(types)) client.declareType(type, schema);
      return { exports: expose(client, methods) };
    } };
  }
  function inspectionModule(rs) {
    return { name: 'inspection', builder() {
      return { exports: expose(rs.scope('/'), [
        'getListing', 'getFile', 'getObject', 'storeFile', 'storeObject', 'remove', 'getItemURL'
      ]) };
    } };
  }
  function withChanges(original, eventName = 'onChange', path = '') {
    return { ...original, builder(privateClient, publicClient) {
      const built = original.builder(privateClient, publicClient);
      return { ...built, exports: { ...built.exports,
        [eventName]: callback => privateClient.scope(path).on('change', callback)
      } };
    } };
  }
  function withPublicLinks(original) {
    return { ...original, builder(privateClient, publicClient) {
      const built = original.builder(privateClient, publicClient);
      return { ...built, exports: { ...built.exports,
        getItemURL: path => publicClient.getItemURL(path),
        putFile: (path, data, type) => publicClient.storeFile(type, path, data),
        removePublicFile: path => publicClient.remove(path)
      } };
    } };
  }
  function attachSolid(rs) {
    if (typeof document === 'undefined' || document.querySelector('[data-pondersource-solid]')) return;
    const panel = document.createElement('details');
    panel.dataset.pondersourceSolid = '';
    panel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;background:white;color:#222;border:1px solid #aaa;border-radius:8px;padding:10px;max-width:min(360px,90vw);font:16px system-ui;box-shadow:0 2px 8px #0002';
    const summary = document.createElement('summary');
    summary.textContent = 'Solid storage';
    panel.append(summary);
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    const form = document.createElement('form');
    const label = document.createElement('label'); label.textContent = 'Solid identity provider';
    const issuer = document.createElement('input'); issuer.type = 'url'; issuer.required = true;
    issuer.placeholder = 'https://solidcommunity.net'; issuer.style.cssText = 'display:block;width:100%;font:inherit;box-sizing:border-box;margin:8px 0';
    label.append(issuer);
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'Connect Solid'; submit.style.font = 'inherit';
    form.append(label, submit);
    const podsForm = document.createElement('form'); podsForm.hidden = true;
    const podsLabel = document.createElement('label'); podsLabel.textContent = 'Choose your pod';
    const pods = document.createElement('select'); pods.style.cssText = 'display:block;max-width:100%;font:inherit;margin:8px 0'; podsLabel.append(pods);
    const choose = document.createElement('button'); choose.type = 'submit'; choose.textContent = 'Use this pod'; choose.style.font = 'inherit';
    podsForm.append(podsLabel, choose);
    const disconnect = document.createElement('button'); disconnect.type = 'button'; disconnect.textContent = 'Disconnect storage'; disconnect.style.font = 'inherit';
    panel.append(status, form, podsForm, disconnect);
    document.body.append(panel);
    function render() {
      panel.hidden = !rs.solid;
      const choosing = rs.backend === 'solid' && rs.solid?.getPodURLs() !== null && !rs.connected;
      form.hidden = !!rs.connected || choosing;
      podsForm.hidden = !choosing;
      disconnect.hidden = !rs.connected && !choosing;
      status.textContent = rs.connected ? (rs.backend === 'solid' ? 'Connected to Solid.' : 'Disconnect your current storage to connect Solid.') : '';
      if (choosing) {
        panel.open = true;
        const urls = rs.solid.getPodURLs() || [];
        pods.replaceChildren(...urls.map(url => new Option(url, url)));
        choose.disabled = urls.length === 0;
        if (!urls.length) status.textContent = 'This account has no advertised pods.';
      }
    }
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true; status.textContent = 'Connecting…';
      try { rs.solid.setAuthURL(issuer.value.trim()); await rs.solid.connect(); }
      catch (error) { status.textContent = error.message || 'Could not connect to Solid.'; submit.disabled = false; }
    });
    podsForm.addEventListener('submit', async event => {
      event.preventDefault(); choose.disabled = true;
      try { await rs.solid.setPodURL(pods.value); render(); }
      catch (error) { status.textContent = error.message || 'Could not open the pod.'; choose.disabled = false; }
    });
    disconnect.addEventListener('click', async () => {
      disconnect.disabled = true;
      try { await rs.disconnect(); render(); }
      catch (error) { status.textContent = error.message || 'Could not disconnect.'; }
      finally { disconnect.disabled = false; submit.disabled = false; }
    });
    for (const event of ['features-loaded', 'ready', 'connected', 'disconnected', 'not-connected', 'pod-not-selected']) rs.on(event, render);
    render();
    return panel;
  }
  return { scopedModule, inspectionModule, withChanges, withPublicLinks, attachSolid };
});
