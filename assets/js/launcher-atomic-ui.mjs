import {
  discoverAtomicNodes, driveId, forgetAtomicConnection, loadAtomicConnection,
  openAtomicLibrary, prepareAtomicConnection, saveAtomicConnection
} from './launcher-atomic.mjs';

export function setupAtomicLauncher({ widget, connect, disconnect, mayConnect, onError }) {
  const element = id => document.getElementById(id);
  const dialog = element('atomic-connect-dialog');
  const form = element('atomic-connect-form');
  const nodeChoices = element('atomic-node-choices');
  const approval = element('atomic-approval');
  const finish = element('atomic-connect-finish');
  const status = element('atomic-connect-status');
  const signOut = element('atomic-disconnect');
  const storageWidget = element('launcher-storage-widget');
  let attempt;
  let revision = 0;

  function clearAttempt() {
    revision++;
    attempt = undefined;
    approval.hidden = true;
    status.textContent = '';
  }
  function setConnected(connected) {
    storageWidget.hidden = connected;
    signOut.hidden = !connected;
  }
  widget.rsChooseAtomicButton.hidden = false;
  // The pinned widget also serves apps using its older provider. Replace
  // the action only in this launcher while keeping its chooser and icon.
  widget.rsChooseAtomicButton.addEventListener('click', event => {
    event.stopImmediatePropagation();
    clearAttempt();
    dialog.showModal();
  }, { capture: true });
  form.addEventListener('input', clearAttempt);
  dialog.addEventListener('close', clearAttempt);
  element('atomic-connect-cancel').addEventListener('click', () => dialog.close());

  element('atomic-find-nodes').addEventListener('click', async () => {
    clearAttempt();
    const generation = revision;
    status.textContent = 'Finding Atomic nodes…';
    try {
      const drive = driveId(form.elements.drive.value);
      const nodes = await discoverAtomicNodes(drive);
      if (!dialog.open || generation !== revision) return;
      nodeChoices.replaceChildren(...nodes.map(node => new Option(node, node)));
      status.textContent = nodes.length
        ? 'Select or enter a node you trust to store your app library.'
        : 'No public node was found. Enter your Atomic node’s HTTPS address.';
    } catch (error) {
      if (generation === revision) status.textContent = error.message;
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearAttempt();
    const generation = revision;
    try {
      if (!mayConnect()) throw new Error('Disconnect your current storage before connecting Atomic.');
      status.textContent = 'Creating this browser’s Atomic app key…';
      const prepared = await prepareAtomicConnection({
        drive: driveId(form.elements.drive.value),
        node: form.elements.node.value,
        approvalSite: form.elements.approvalSite.value
      });
      if (!dialog.open || generation !== revision) return;
      attempt = prepared.connection;
      element('atomic-approval-link').href = prepared.grantUrl;
      approval.hidden = false;
      status.textContent = 'Approve this app key in Atomic, then finish connecting here.';
    } catch (error) {
      if (generation === revision) status.textContent = error.message;
    }
  });

  finish.addEventListener('click', async () => {
    if (!attempt || finish.disabled) return;
    const connection = attempt;
    const generation = revision;
    finish.disabled = true;
    try {
      if (!mayConnect()) throw new Error('Disconnect your current storage before connecting Atomic.');
      const library = await openAtomicLibrary(connection);
      if (!dialog.open || generation !== revision || !mayConnect()) return;
      await saveAtomicConnection(connection);
      if (!dialog.open || generation !== revision || !mayConnect()) {
        await forgetAtomicConnection();
        return;
      }
      setConnected(true);
      connect(library);
      dialog.close();
    } catch (error) {
      if (generation === revision) status.textContent = 'Could not connect Atomic. ' + error.message;
    } finally {
      finish.disabled = false;
    }
  });

  signOut.addEventListener('click', async () => {
    signOut.disabled = true;
    try {
      await forgetAtomicConnection();
      setConnected(false);
      disconnect();
    } catch (error) {
      onError('Could not disconnect Atomic. ' + error.message);
    } finally {
      signOut.disabled = false;
    }
  });

  return async () => {
    try {
      const saved = await loadAtomicConnection();
      if (!saved || !mayConnect()) return;
      setConnected(true);
      const library = await openAtomicLibrary(saved);
      if (mayConnect()) connect(library);
      else setConnected(false);
    } catch (error) {
      onError('Could not reopen Atomic storage. ' + error.message);
    }
  };
}
