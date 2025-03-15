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
        if (!response.ok) {
            throw new Error(`Error al obtener datos del API: ${response.status} ${response.statusText}`);
        }
        data = await response.json();
        if (data?.monitors) {
            MONITORS.forEach(id => updateMonitor(id, data.monitors[id]));
            // Inicializar la calculadora con los datos de la API
            initializeCalculator();
        } else {
            console.error('Error: La estructura de la respuesta del API no contiene "monitors".');
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

/* === CÓDIGO PARA LA CALCULADORA (FILTRAR PEGADO) === */
const amountInput = document.getElementById('amount');
const customRateInput = document.getElementById('custom-rate');
const currencyTypeSelect = document.getElementById('currency-type');
const exchangeRateSelect = document.getElementById('exchange-rate');
const conversionResult = document.getElementById('conversion-result');
const copyBtn = document.getElementById('copy-btn');
const copyMessage = document.getElementById('copy-message');
const customRateError = document.getElementById('custom-rate-error');
const amountError = document.getElementById('amount-error');
const rateError = document.getElementById('rate-error');

function formatNumber(value) {
    return parseFloat(value).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function validateDecimalPlaces(inputElement, maxDecimalPlaces) {
    let value = inputElement.value;
    const decimalSeparator = '.';
    if (value.includes(decimalSeparator)) {
        const parts = value.split(decimalSeparator);
        if (parts[1] && parts[1].length > maxDecimalPlaces) {
            inputElement.value = parts[0] + decimalSeparator + parts[1].substring(0, maxDecimalPlaces);
        }
    }
}

amountInput.addEventListener('keypress', function(event) {
    const charCode = event.which ? event.which : event.keyCode;
    const char = String.fromCharCode(charCode);
    if (!/^[0-9.,]+$/.test(char)) {
        event.preventDefault();
    }
});

amountInput.addEventListener('input', function() {
    const newValue = this.value;
    const validChars = /^[0-9.,]*$/;
    if (!validChars.test(newValue)) {
        this.value = newValue.replace(/[^0-9.,]/g, '');
    }
    validateDecimalPlaces(this, 2);
    if (this.value.length > 15 && !isNaN(parseFloat(this.value))) {
        this.value = this.value.slice(0, 15);
    }
    amountError.textContent = '';
    convertCurrency();
});

amountInput.addEventListener('paste', function(event) {
    event.preventDefault();
    const pastedText = (event.clipboardData || window.clipboardData).getData('text');
    const validPastedText = pastedText.replace(/[^0-9.,]/g, '');
    this.value += validPastedText;
    // Disparar el evento 'input' para que se ejecuten las validaciones
    this.dispatchEvent(new Event('input'));
});

customRateInput.addEventListener('keypress', function(event) {
    const charCode = event.which ? event.which : event.keyCode;
    const char = String.fromCharCode(charCode);
    if (!/^[0-9.,]+$/.test(char)) {
        event.preventDefault();
    }
});

customRateInput.addEventListener('input', function() {
    const newValue = this.value;
    const validChars = /^[0-9.,]*$/;
    if (!validChars.test(newValue)) {
        this.value = newValue.replace(/[^0-9.,]/g, '');
    }
    validateDecimalPlaces(this, 2);
    if (this.value.length > 15 && !isNaN(parseFloat(this.value))) {
        this.value = this.value.slice(0, 15);
    }
    customRateError.textContent = '';
    convertCurrency();
});

customRateInput.addEventListener('paste', function(event) {
    event.preventDefault();
    const pastedText = (event.clipboardData || window.clipboardData).getData('text');
    const validPastedText = pastedText.replace(/[^0-9.,]/g, '');
    this.value += validPastedText;
    // Disparar el evento 'input' para que se ejecuten las validaciones
    this.dispatchEvent(new Event('input'));
});

function getRateFromAPI(rateType) {
    if (!data.monitors || !data.monitors[rateType] || typeof data.monitors[rateType].price === 'undefined' || data.monitors[rateType].price === null) {
        console.warn(`Advertencia: No se encontraron datos de precio válidos para el monitor "${rateType}".`);
        return null;
    }
    const priceString = data.monitors[rateType].price.toString().replace(',', '');
    const price = parseFloat(priceString.replace(',', '.'));
    if (isNaN(price)) {
        console.error(`Error: No se pudo convertir el precio "${data.monitors[rateType].price}" a un número para el monitor "${rateType}".`);
        return null;
    }
    return price;
}

function convertCurrency() {
    const amount = parseFloat(amountInput.value);
    const currencyType = currencyTypeSelect.value;
    const selectedRateType = exchangeRateSelect.value;
    let rate;

    if (isNaN(amount) && amountInput.value.trim() !== '') {
        amountError.textContent = 'Ingrese una cantidad válida.';
        conversionResult.textContent = '';
        copyBtn.style.display = 'none';
        return;
    } else if (amount <= 0 && amountInput.value.trim() !== '') {
        amountError.textContent = 'La cantidad debe ser mayor que cero.';
        conversionResult.textContent = '';
        copyBtn.style.display = 'none';
        return;
    } else if (amountInput.value.trim() === '') {
        amountError.textContent = '';
        conversionResult.textContent = '';
        copyBtn.style.display = 'none';
        return;
    }

    if (selectedRateType === 'custom') {
        rate = parseFloat(customRateInput.value);
        if (isNaN(rate) && customRateInput.value.trim() !== '') {
            customRateError.textContent = 'Ingrese una tasa personalizada válida.';
            conversionResult.textContent = '';
            copyBtn.style.display = 'none';
            return;
        } else if (rate <= 0 && customRateInput.value.trim() !== '') {
            customRateError.textContent = 'La tasa debe ser mayor que cero.';
            conversionResult.textContent = '';
            copyBtn.style.display = 'none';
            return;
        } else if (customRateInput.value.trim() === '') {
            customRateError.textContent = '';
            conversionResult.textContent = '';
            copyBtn.style.display = 'none';
            return;
        }
    } else {
        rate = getRateFromAPI(selectedRateType);
        if (rate === null || rate <= 0) {
            rateError.textContent = 'No se pudo obtener la tasa de cambio.';
            conversionResult.textContent = '';
            copyBtn.style.display = 'none';
            return;
        }
        rateError.textContent = '';
    }

    if (!isNaN(amount) && typeof rate === 'number' && rate > 0) {
        let result;
        let formattedResult;
        let targetCurrency;

        if (currencyType === 'bolivares-to-dollars') {
            result = amount / rate;
            targetCurrency = 'USD';
        } else if (currencyType === 'dollars-to-bolivares') {
            result = amount * rate;
            targetCurrency = 'VEF';
        }

        formattedResult = formatNumber(result);
        conversionResult.textContent = `${formattedResult} ${targetCurrency}`;
        conversionResult.classList.add('conversion-result-styled');
        copyBtn.style.display = 'inline-block';
    } else {
        conversionResult.textContent = '';
        conversionResult.classList.add('conversion-result-styled');
        copyBtn.style.display = 'none';
    }
}

exchangeRateSelect.addEventListener('change', function() {
    if (this.value === 'custom') {
        customRateInput.style.display = 'block';
    } else {
        customRateInput.style.display = 'none';
        customRateInput.value = '';
        customRateError.textContent = '';
    }
    convertCurrency();
});

currencyTypeSelect.addEventListener('change', convertCurrency);

copyBtn.addEventListener('click', function() {
    let textToCopy = conversionResult.textContent.split(' ')[0];
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            copyMessage.style.display = 'block';
            setTimeout(() => {
                copyMessage.style.display = 'none';
            }, 2000);
        })
        .catch(err => {
            console.error('Error al copiar al portapapeles:', err);
        });
});

function initializeCalculator() {
    // Limpiar los inputs al inicializar
    amountInput.value = '';
    customRateInput.value = '';
    conversionResult.textContent = '';
    conversionResult.classList.add('conversion-result-styled');
    copyBtn.style.display = 'none';
    amountError.textContent = '';
    customRateError.textContent = '';
    rateError.textContent = '';

    // Mostrar el input de tasa personalizada si está seleccionado al cargar
    if (exchangeRateSelect.value === 'custom') {
        customRateInput.style.display = 'block';
    } else {
        customRateInput.style.display = 'none';
    }

    // No llamamos a convertCurrency() aquí para evitar el '0.00' inicial
}

// Inicialización
fetchData();

// Asegurar que al cargar la página se ejecute la lógica de inicialización
document.addEventListener('DOMContentLoaded', () => {
    initializeCalculator();
});

// Evento para mostrar/ocultar el input de tasa personalizada al cargar la página
window.addEventListener('load', () => {
    const exchangeRateSelectElement = document.getElementById('exchange-rate');
    const customRateInputElement = document.getElementById('custom-rate-input');
    if (exchangeRateSelectElement && exchangeRateSelectElement.value === 'custom') {
        customRateInputElement.style.display = 'block';
    }
});

// Aplicar clase a los inputs para el tamaño de fuente
document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('.form-container input[type="number"], .form-container select, .form-container input[type="text"]');
    inputs.forEach(input => {
        input.classList.add('form-input-styled');
    });
});