const MONITORS = ['bcv', 'enparalelovzla', 'promedio'];
const IMAGES = {
  bcv: 'bcv.webp',
  enparalelovzla: 'paralelo.png',
  promedio: 'promedio.webp'
};

let data = {};

/* === CÓDIGO PARA TASAS === */
const fetchData = async () => {
  try {
    const response = await fetch('https://pydolarve.org/api/v1/dollar?page=criptodolar&format_date=default&rounded_price=true');
    if (!response.ok) throw new Error('Error al obtener datos');
    data = await response.json();
    if (data?.monitors) {
      MONITORS.forEach(id => updateMonitor(id, data.monitors[id]));
    }
  } catch (error) {
    console.error('Error en solicitud API:', error);
  }
};

const updateMonitor = (id, monitor) => {
  if (!monitor) return;

  document.getElementById(`${id}-image`)?.setAttribute('src', IMAGES[id]);

  const elements = {
    title: document.getElementById(`${id}-title`),
    price: document.getElementById(`${id}-price`),
    lastUpdate: document.getElementById(`${id}-last-update`),
    oldPrice: document.getElementById(`${id}-old-price`),
    change: document.getElementById(`${id}-change`),
    percentage: document.getElementById(`${id}-percentage`)
  };

  if (elements.title) elements.title.textContent = monitor.title;
  if (elements.price) elements.price.textContent = `${monitor.symbol} ${monitor.price} VEF`;
  if (elements.lastUpdate) elements.lastUpdate.textContent = monitor.last_update;
  if (elements.oldPrice) elements.oldPrice.textContent = `Anterior: ${monitor.price_old} VEF`;

  if (elements.change && elements.percentage) {
    elements.change.textContent = `${monitor.color === 'green' ? '+' : '-'}${monitor.change}`;
    elements.percentage.textContent = `${monitor.color === 'green' ? '+' : '-'}${monitor.percent}%`;

    elements.change.classList.toggle('positive', monitor.color === 'green');
    elements.change.classList.toggle('negative', monitor.color === 'red');
    elements.percentage.classList.toggle('positive', monitor.color === 'green');
    elements.percentage.classList.toggle('negative', monitor.color === 'red');
  }
};

/* === CALCULADORA CORREGIDA === */
class CurrencyCalculator {
  constructor() {
    this.elements = {
      amount: document.getElementById('amount'),
      result: document.getElementById('conversion-result'),
      currencyType: document.getElementById('currency-type'),
      rateSelect: document.getElementById('exchange-rate'),
      customRate: document.getElementById('custom-rate'),
      copyBtn: document.getElementById('copy-btn'),
      copyMsg: document.getElementById('copy-message')
    };
    
    this.initCalculator();
  }

  initCalculator() {
    this.setupEventListeners();
    this.toggleCustomRate();
    this.clearInputs();
    this.debounceTimeout = null;
  }

  clearInputs() {
    this.elements.amount.value = '';
    this.elements.customRate.value = '';
    this.elements.result.textContent = '';
  }

  setupEventListeners() {
    this.elements.amount.addEventListener('input', (e) => this.handleInput(e.target));
    this.elements.currencyType.addEventListener('change', () => this.convert());
    this.elements.rateSelect.addEventListener('change', () => {
      this.toggleCustomRate();
      this.convert();
    });
    this.elements.customRate.addEventListener('input', (e) => this.handleInput(e.target));
    this.elements.copyBtn.addEventListener('click', () => this.copyResult());
  }

  validateInput(input) {
    let value = input.value.trim();
    value = value.replace(/,/g, '.');

    if (!/^[\d.]*$/.test(value)) {
      this.displayResult('Solo se permiten números.');
      return false;
    }

    if (value.length > 15) {
      this.displayResult('Número demasiado largo.');
      return false;
    }

    const parts = value.split('.');
    if (parts.length > 2 || (parts[1] && parts[1].length > 2) || (parts[0].length > 13)) {
      this.displayResult('Formato incorrecto, use hasta dos decimales.');
      return false;
    }

    return true;
  }

  handleInput(inputElement) {
    if (this.validateInput(inputElement)) {
      inputElement.value = inputElement.value.replace(/,/g, '.');
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => this.convert(), 300);
    }
  }

  toggleCustomRate() {
    this.elements.customRate.style.display = 
      this.elements.rateSelect.value === 'custom' ? 'block' : 'none';
  }

  getConversionRate() {
    if (this.elements.rateSelect.value === 'custom') {
      const rate = parseFloat(this.elements.customRate.value);
      return isNaN(rate) || rate <= 0 ? null : rate;
    }
    
    const price = data.monitors?.[this.elements.rateSelect.value]?.price;
    return price && price > 0 ? parseFloat(price) : null;
  }

  convert() {
    const amount = parseFloat(this.elements.amount.value);
    const rate = this.getConversionRate();
    const isToUSD = this.elements.currencyType.value === 'bolivares-to-dollars';
    const currency = isToUSD ? 'USD' : 'VEF';

    if (!this.elements.amount.value.trim() && !this.elements.customRate.value.trim()) {
      this.elements.result.textContent = ''; 
      this.elements.copyBtn.style.display = 'none';
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      this.displayResult('Ingrese un monto válido.');
      this.elements.copyBtn.style.display = 'none';
      return;
    }

    if (!rate) {
      this.displayResult('Seleccione una tasa de cambio válida.');
      this.elements.copyBtn.style.display = 'none';
      return;
    }

    const result = isToUSD ? (amount / rate) : (amount * rate);

    if (!isFinite(result)) {
      this.displayResult('Error en el cálculo, revise los valores.');
      this.elements.copyBtn.style.display = 'none';
      return;
    }

    this.displayResult(result, currency);
  }

  formatResult(value) {
    return new Intl.NumberFormat('es-VE', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  displayResult(value, currency) {
    if (typeof value === 'string') {
      this.elements.result.textContent = value;
      this.elements.copyBtn.style.display = 'none';
    } else {
      const formattedValue = this.formatResult(value);
      this.elements.result.textContent = `${formattedValue} ${currency}`;
      this.elements.copyBtn.style.display = 'inline-block';
    }
  }

  copyResult() {
    const text = this.elements.result.textContent.replace(/[^\d.]/g, '');
    navigator.clipboard.writeText(text).then(() => {
      this.elements.copyMsg.style.display = 'block';
      setTimeout(() => {
        this.elements.copyMsg.style.display = 'none';
      }, 2000);
    });
  }
}

// Inicialización
fetchData();
new CurrencyCalculator();
