const IMAGES = {
  bcv: 'bcv.webp',
  enparalelovzla: 'paralelo.png',
  promedio: 'promedio.webp'
};

let data = {};

const fetchData = async () => {
  try {
    const response = await fetch('https://pydolarve.org/api/v1/dollar?page=criptodolar&format_date=default&rounded_price=true');
    if (!response.ok) throw new Error('Error al obtener los datos');
    data = await response.json();

    if (data?.monitors) {
      ['bcv', 'enparalelovzla', 'promedio'].forEach(monitorId => {
        updateMonitor(monitorId, data.monitors[monitorId]);
      });
    } else {
      console.error('Los datos de los monitores no están disponibles');
    }
  } catch (error) {
    console.error('Hubo un problema con la solicitud de la API:', error);
  }
};

const updateMonitor = (monitorId, monitorData) => {
  if (!monitorData) {
    console.error(`Los datos de ${monitorId} no están disponibles`);
    return;
  }

  const setText = (suffix, text, display = null) => {
    const el = document.getElementById(`${monitorId}-${suffix}`);
    if (el) {
      el.innerText = text;
      if (display !== null) el.style.display = display;
    }
  };

  setText('title', monitorData.title, 'block');
  setText('price', `${monitorData.symbol} ${monitorData.price} VEF`);
  setText('last-update', monitorData.last_update);
  setText('old-price', `Anterior: ${monitorData.price_old} VEF`);

  const imageEl = document.getElementById(`${monitorId}-image`);
  if (imageEl && IMAGES[monitorId]) imageEl.src = IMAGES[monitorId];

  const changeEl = document.getElementById(`${monitorId}-change`);
  const percentageEl = document.getElementById(`${monitorId}-percentage`);

  if (changeEl && percentageEl) {
    changeEl.classList.remove('positive', 'negative');
    percentageEl.classList.remove('positive', 'negative');

    if (monitorData.color === 'green') {
      changeEl.innerText = `+${monitorData.change}`;
      percentageEl.innerText = `+${monitorData.percent}%`;
      changeEl.classList.add('positive');
      percentageEl.classList.add('positive');
    } else if (monitorData.color === 'red') {
      changeEl.innerText = `-${monitorData.change}`;
      percentageEl.innerText = `-${monitorData.percent}%`;
      changeEl.classList.add('negative');
      percentageEl.classList.add('negative');
    } else {
      changeEl.innerText = monitorData.change;
      percentageEl.innerText = `${monitorData.percent}%`;
    }
  }
};

const toggleCustomRate = () => {
  const rateSelect = document.getElementById('exchange-rate');
  const customRateInput = document.getElementById('custom-rate');
  if (rateSelect && customRateInput) {
    customRateInput.style.display = rateSelect.value === 'custom' ? 'block' : 'none';
  }
};

const validateInput = input => {
  input.value = input.value.replace(/[^0-9.]/g, '');
  const dots = (input.value.match(/\./g) || []).length;
  if (dots > 1) {
    input.value = input.value.substring(0, input.value.lastIndexOf('.'));
  }
};

const setConversionResult = (text, showCopy = false) => {
  const conversionEl = document.getElementById('conversion-result');
  if (conversionEl) conversionEl.innerText = text;
  const copyBtn = document.getElementById('copy-btn');
  if (copyBtn) copyBtn.style.display = showCopy ? 'inline-block' : 'none';
};

const calculate = () => {
  const amountInput = document.getElementById('amount')?.value.trim();
  const customRateValue = document.getElementById('custom-rate')?.value.trim();
  const rateType = document.getElementById('exchange-rate')?.value;

  if (!amountInput && !customRateValue) {
    return setConversionResult('');
  }
  if (!amountInput || /[^0-9.]/.test(amountInput)) {
    return setConversionResult("Solo se permiten valores numéricos en la cantidad");
  }

  const amount = parseFloat(amountInput);
  if (amount <= 0) {
    return setConversionResult("La cantidad debe ser mayor que 0");
  }

  let rate = 0;
  if (rateType === 'custom') {
    if (!customRateValue) return setConversionResult("Ingresa una tasa personalizada");
    if (/[^0-9.]/.test(customRateValue)) return setConversionResult("Solo se permiten valores numéricos en la tasa personalizada");
    rate = parseFloat(customRateValue);
    if (rate <= 0) return setConversionResult("La tasa personalizada debe ser mayor que 0");
  } else {
    rate = data.monitors?.[rateType]?.price || 0;
  }

  const currencyType = document.getElementById('currency-type')?.value;
  const result = currencyType === 'bolivares-to-dollars' ? amount / rate : amount * rate;
  const currencySymbol = currencyType === 'bolivares-to-dollars' ? 'USD' : 'VEF';

  const formattedResult = new Intl.NumberFormat('de-DE', {
    style: 'decimal',
    minimumFractionDigits: 2
  }).format(result);
  setConversionResult(`${formattedResult} ${currencySymbol}`, true);
};

const copyResult = () => {
  const resultText = document.getElementById('conversion-result')?.innerText;
  if (!resultText || resultText.includes("Ingresa una cantidad válida") || resultText.includes("Solo se permiten valores numéricos")) {
    return;
  }
  const numberResult = resultText.replace(/[^\d,.-]/g, '');
  navigator.clipboard.writeText(numberResult)
    .then(showCopiedMessage)
    .catch(error => console.error('Error al copiar el resultado: ', error));
};

const showCopiedMessage = () => {
  const copyMessage = document.getElementById('copy-message');
  if (copyMessage) {
    copyMessage.style.display = 'block';
    setTimeout(() => copyMessage.style.display = 'none', 5000);
  }
};

window.addEventListener('load', () => {
  document.getElementById('amount').value = '';
  document.getElementById('custom-rate').value = '';
  toggleCustomRate();
  calculate();
});

document.getElementById('amount')?.addEventListener('input', function () {
  validateInput(this);
  if (/[^0-9.]/.test(this.value)) {
    setConversionResult("Solo se permiten valores numéricos en la cantidad");
  } else {
    calculate();
  }
});
document.getElementById('currency-type')?.addEventListener('change', calculate);
document.getElementById('exchange-rate')?.addEventListener('change', () => {
  toggleCustomRate();
  calculate();
});
document.getElementById('custom-rate')?.addEventListener('input', function () {
  validateInput(this);
  calculate();
});
document.getElementById('copy-btn')?.addEventListener('click', copyResult);

fetchData();