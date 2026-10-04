let beneficiaries = [];
let editingBeneficiaryId = null;

const beneficiaryList = document.querySelector('#beneficiary-list');
const beneficiaryModal = document.querySelector('#beneficiary-modal');
const beneficiaryForm = document.querySelector('#beneficiary-form');
const beneficiaryName = document.querySelector('#beneficiary-name');
const beneficiaryDestination = document.querySelector('#beneficiary-destination');
const beneficiarySearch = document.querySelector('#beneficiary-search');
const beneficiaryMessage = document.querySelector('#beneficiary-message');
const beneficiaryFormMessage = document.querySelector('#beneficiary-form-message');

const setMessage = (element, message) => {
  element.textContent = message;
};

const closeBeneficiaryModal = () => {
  beneficiaryModal.hidden = true;
  editingBeneficiaryId = null;
  beneficiaryForm.reset();
  setMessage(beneficiaryFormMessage, '');
};

const openBeneficiaryModal = (beneficiary = null) => {
  editingBeneficiaryId = beneficiary?.id || null;
  document.querySelector('#beneficiary-modal-title').textContent = beneficiary ? 'Edit Beneficiary' : 'Add Beneficiary';
  beneficiaryForm.querySelector('.modal-submit').textContent = beneficiary ? 'Save Changes' : 'Save Beneficiary';
  beneficiaryName.value = beneficiary?.name || '';
  beneficiaryDestination.value = beneficiary?.destination || '';
  setMessage(beneficiaryFormMessage, '');
  beneficiaryModal.hidden = false;
  beneficiaryName.focus();
};

const renderBeneficiaries = () => {
  const query = beneficiarySearch.value.trim().toLowerCase();
  const filteredBeneficiaries = beneficiaries.filter((beneficiary) => (
    `${beneficiary.name} ${beneficiary.destination}`.toLowerCase().includes(query)
  ));
  beneficiaryList.replaceChildren();
  if (!filteredBeneficiaries.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-accounts';
    empty.textContent = beneficiaries.length ? 'No beneficiaries match your search.' : 'No beneficiaries saved yet.';
    if (!beneficiaries.length) {
      const addButton = document.createElement('button');
      addButton.className = 'modal-submit';
      addButton.type = 'button';
      addButton.textContent = 'Add your first beneficiary';
      addButton.addEventListener('click', () => openBeneficiaryModal());
      empty.append(document.createElement('br'), document.createElement('br'), addButton);
    }
    beneficiaryList.append(empty);
    return;
  }

  filteredBeneficiaries.forEach((beneficiary) => {
    const card = document.createElement('article');
    card.className = 'beneficiary-card';
    const identity = document.createElement('div');
    identity.className = 'beneficiary-card__identity';
    const mark = document.createElement('span');
    mark.className = 'beneficiary-mark';
    mark.textContent = beneficiary.name.charAt(0).toUpperCase();
    const copy = document.createElement('div');
    copy.className = 'beneficiary-card__copy';
    const name = document.createElement('strong');
    name.textContent = beneficiary.name;
    const destination = document.createElement('small');
    destination.textContent = beneficiary.destination;
    copy.append(name, destination);
    identity.append(mark, copy);

    const actions = document.createElement('div');
    actions.className = 'beneficiary-actions';
    const editButton = document.createElement('button');
    editButton.className = 'beneficiary-action beneficiary-action--edit';
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => openBeneficiaryModal(beneficiary));
    const deleteButton = document.createElement('button');
    deleteButton.className = 'beneficiary-action beneficiary-action--delete';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(`Delete ${beneficiary.name} from your beneficiaries?`)) return;
      deleteButton.disabled = true;
      try {
        await window.RVPayAPI.deleteBeneficiary(beneficiary.id);
        beneficiaries = beneficiaries.filter((item) => item.id !== beneficiary.id);
        setMessage(beneficiaryMessage, '');
        renderBeneficiaries();
      } catch (error) {
        setMessage(beneficiaryMessage, error.message);
        deleteButton.disabled = false;
      }
    });
    actions.append(editButton, deleteButton);
    card.append(identity, actions);
    beneficiaryList.append(card);
  });
};

document.querySelector('#add-beneficiary').addEventListener('click', () => openBeneficiaryModal());
beneficiarySearch.addEventListener('input', renderBeneficiaries);
document.querySelector('#close-beneficiary-modal').addEventListener('click', closeBeneficiaryModal);
document.querySelector('#cancel-beneficiary-modal').addEventListener('click', closeBeneficiaryModal);
beneficiaryModal.addEventListener('click', (event) => {
  if (event.target === beneficiaryModal) closeBeneficiaryModal();
});

beneficiaryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = beneficiaryForm.querySelector('.modal-submit[type="submit"]');
  const payload = { name: beneficiaryName.value.trim(), destination: beneficiaryDestination.value.trim() };
  submitButton.disabled = true;
  setMessage(beneficiaryFormMessage, 'Saving beneficiary...');

  try {
    if (editingBeneficiaryId) {
      const response = await window.RVPayAPI.updateBeneficiary(editingBeneficiaryId, payload);
      beneficiaries = beneficiaries.map((beneficiary) => (
        beneficiary.id === editingBeneficiaryId ? response.beneficiary : beneficiary
      ));
    } else {
      const response = await window.RVPayAPI.addBeneficiary(payload);
      beneficiaries.push(response.beneficiary);
    }
    beneficiaries.sort((first, second) => first.name.localeCompare(second.name));
    setMessage(beneficiaryMessage, '');
    closeBeneficiaryModal();
    renderBeneficiaries();
  } catch (error) {
    setMessage(beneficiaryFormMessage, error.message);
  } finally {
    submitButton.disabled = false;
  }
});

const loadBeneficiaries = async () => {
  beneficiaryList.textContent = 'Loading beneficiaries...';
  try {
    const response = await window.RVPayAPI.getBeneficiaries();
    beneficiaries = response.beneficiaries || [];
    renderBeneficiaries();
  } catch (error) {
    beneficiaryList.replaceChildren();
    const message = document.createElement('p');
    message.className = 'empty-accounts';
    message.textContent = error.message;
    beneficiaryList.append(message);
  }
};

loadBeneficiaries();