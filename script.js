const MONITORS = ['bcv', 'enparalelovzla', 'promedio'];
const IMAGES = {
    bcv: 'bcv.webp',
    enparalelovzla: 'paralelo.png',
    promedio: 'promedio.webp'
};

let bcvRate = null;
let enparalelovzlaRate = null;
let promedioRate = null;

/* === FUNCIÓN PARA FORMATEAR NÚMEROS EN FORMATO VENEZOLANO === */
function formatVenezuelanCurrency(value) {
    return parseFloat(value).toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/* === CÓDIGO PARA TASAS === */
const fetchData = async () => {
    const startTime = performance.now();
    try {
        const response = await fetch('https://pydolarve.org/api/v1/dollar?page=criptodolar&format_date=default&rounded_price=true');
        if (!response.ok) {
            throw new Error(`Error al obtener datos del API: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (data?.monitors) {
            updateMonitorValues(data.monitors);
            MONITORS.forEach(id => updateMonitorDisplay(id, data.monitors[id]));
            convertCurrency(); // Actualizar la calculadora con los nuevos datos
        } else {
            console.error('Error: La estructura de la respuesta del API no contiene "monitors".');
        }
    } catch (error) {
        console.error('Error en solicitud API:', error);
    } finally {
        const endTime = performance.now();
        const fetchTime = endTime - startTime;
        console.log(`Tiempo de fetchData: ${fetchTime.toFixed(2)} ms`);
    }
};

const updateMonitorValues = (monitors) => {
    bcvRate = parseFloat(monitors?.bcv?.price?.toString().replace(',', '.') || null);
    enparalelovzlaRate = parseFloat(monitors?.enparalelovzla?.price?.toString().replace(',', '.') || null);
    promedioRate = parseFloat(monitors?.promedio?.price?.toString().replace(',', '.') || null);
};

const updateMonitorDisplay = (id, monitor) => {
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
    if (elements.price) {
        const formattedPrice = formatVenezuelanCurrency(monitor.price);
        elements.price.textContent = `Bs ${formattedPrice}`;
    }
    if (elements.lastUpdate) elements.lastUpdate.textContent = monitor.last_update;
    if (elements.oldPrice) {
        const formattedOldPrice = formatVenezuelanCurrency(monitor.price_old);
        elements.oldPrice.textContent = `Anterior: Bs ${formattedOldPrice}`;
    }

    if (elements.change && elements.percentage) {
        elements.change.textContent = `${monitor.color === 'green' ? '+' : '-'}${monitor.change}`;
        elements.percentage.textContent = `${monitor.color === 'green' ? '+' : '-'}${monitor.percent}%`;

        elements.change.classList.toggle('positive', monitor.color === 'green');
        elements.change.classList.toggle('negative', monitor.color === 'red');
        elements.percentage.classList.toggle('positive', monitor.color === 'green');
        elements.percentage.classList.toggle('negative', monitor.color === 'red');
    }
};

/* === CÓDIGO PARA LA CALCULADORA === */
const amountInput = document.getElementById('amount');
const currencyTypeSelect = document.getElementById('currency-type');
const exchangeRateSelect = document.getElementById('exchange-rate');
const customRateInput = document.getElementById('custom-rate');
const conversionResult = document.getElementById('conversion-result');
const copyBtn = document.getElementById('copy-btn');
const copyMessage = document.getElementById('copy-message');
const amountError = document.getElementById('amount-error');
const rateError = document.getElementById('rate-error');
let customRateError = null; // Declarar la variable aquí

function normalizeDecimalSeparator(value) {
    const parts = value.replace(/[^0-9,.]/g, '').split(/[.,]/);
    if (parts.length > 2) {
        return parts[0] + ',' + parts.slice(1).join('');
    }
    if (value.includes('.')) {
        return value.replace('.', ',');
    }
    return value;
}

function handleInputValue(inputElement, errorElement) {
    let value = inputElement.value;
    const decimalSeparator = value.includes(',') || value.includes('.');
    const nonDigitOrSeparator = /[^0-9,.]/g;

    inputElement.value = value.replace(nonDigitOrSeparator, '');

    if (decimalSeparator) {
        const parts = inputElement.value.split(/[,.]/);
        if (parts.length > 1) {
            parts[1] = parts[1].slice(0, 2);
            inputElement.value = parts.join(',');
        }
        const countCommas = inputElement.value.split(',').length - 1;
        const countDots = inputElement.value.split('.').length - 1;
        if (countCommas > 1 || countDots > 1) {
            inputElement.value = inputElement.value.slice(0, -1);
        }
    }

    if (inputElement.value.length > 15) {
        inputElement.value = inputElement.value.slice(0, 15);
    }
    errorElement.textContent = '';
    convertCurrency();
}

amountInput.addEventListener('input', function() {
    handleInputValue(this, amountError);
});

customRateInput.addEventListener('input', function() {
    handleInputValue(this, customRateError);
});

function convertCurrency() {
    const amountInputValue = amountInput.value;
    const customRateInputValue = customRateInput.value;

    const normalizedAmount = normalizeDecimalSeparator(amountInputValue).replace(',', '.');
    const normalizedCustomRate = normalizeDecimalSeparator(customRateInputValue).replace(',', '.');

    const amount = parseFloat(normalizedAmount);
    const currencyType = currencyTypeSelect.value;
    const selectedRateType = exchangeRateSelect.value;
    let rate = null;

    if (isNaN(amount) && amountInputValue.trim() !== '') {
        amountError.textContent = 'Ingrese una cantidad válida.';
        conversionResult.textContent = '0,00';
        copyBtn.style.display = 'none';
        return;
    } else if (amount <= 0 && amountInputValue.trim() !== '') {
        amountError.textContent = 'La cantidad debe ser mayor que cero.';
        conversionResult.textContent = '0,00';
        copyBtn.style.display = 'none';
        return;
    } else if (amountInputValue.trim() === '') {
        amountError.textContent = '';
        conversionResult.textContent = '0,00';
        copyBtn.style.display = 'none';
        return;
    }

    if (selectedRateType === 'custom') {
        rate = parseFloat(normalizedCustomRate);
        if (isNaN(rate) && customRateInputValue.trim() !== '') {
            if (customRateError) customRateError.textContent = 'Ingrese una tasa personalizada válida.';
            conversionResult.textContent = '0,00';
            copyBtn.style.display = 'none';
            return;
        } else if (rate <= 0 && customRateInputValue.trim() !== '') {
            if (customRateError) customRateError.textContent = 'La tasa debe ser mayor que cero.';
            conversionResult.textContent = '0,00';
            copyBtn.style.display = 'none';
            return;
        } else if (customRateInputValue.trim() === '') {
            if (customRateError) customRateError.textContent = '';
            conversionResult.textContent = '0,00';
            copyBtn.style.display = 'none';
            return;
        }
    } else {
        if (selectedRateType === 'bcv') {
            rate = bcvRate;
        } else if (selectedRateType === 'enparalelovzla') {
            rate = enparalelovzlaRate;
        } else if (selectedRateType === 'promedio') {
            rate = promedioRate;
        }

        if (rate === null || isNaN(rate) || rate <= 0) {
            rateError.textContent = 'No se pudo obtener la tasa de cambio.';
            conversionResult.textContent = '0,00';
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
            targetCurrency = 'Bs';
        }

        formattedResult = formatVenezuelanCurrency(result);
        conversionResult.textContent = `${formattedResult} ${targetCurrency}`;
        conversionResult.classList.add('conversion-result-styled');
        copyBtn.style.display = 'inline-block';
    } else if (amountInputValue.trim() !== '' || (selectedRateType === 'custom' && customRateInputValue.trim() !== '')) {
        conversionResult.textContent = '0,00';
        conversionResult.classList.add('conversion-result-styled');
        copyBtn.style.display = 'none';
    } else {
        conversionResult.textContent = '0,00';
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
        if (customRateError) customRateError.textContent = '';
    }
    convertCurrency();
});

currencyTypeSelect.addEventListener('change', convertCurrency);

copyBtn.addEventListener('click', function() {
    let textToCopy = conversionResult.textContent.split(' ')[0];
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            console.log('Copiado exitoso'); // Para depuración
            copyMessage.textContent = '¡Copiado!';
            copyMessage.classList.remove('error');
            copyMessage.classList.add('show');
            setTimeout(() => {
                copyMessage.classList.remove('show');
            }, 2000);
        })
        .catch(err => {
            console.error('Error al copiar al portapapeles:', err);
            console.log('Error al copiar'); // Para depuración
            copyMessage.textContent = 'Error al copiar';
            copyMessage.classList.add('show', 'error');
            setTimeout(() => {
                copyMessage.classList.remove('show', 'error');
            }, 2000);
        });
});

function initializeCalculator() {
    amountInput.value = '';
    customRateInput.value = '';
    conversionResult.textContent = '0,00';
    conversionResult.classList.add('conversion-result-styled');
    copyBtn.style.display = 'none';
    amountError.textContent = '';

    customRateError = document.getElementById('custom-rate-error'); // Asignar el elemento aquí

    if (customRateError) {
        customRateError.textContent = '';
    } else {
        console.error('Error: El elemento custom-rate-error no se encontró en el DOM.');
    }

    rateError.textContent = '';

    if (exchangeRateSelect.value === 'custom') {
        customRateInput.style.display = 'block';
    } else {
        customRateInput.style.display = 'none';
    }

    convertCurrency(); // Asegurar una conversión inicial
}

document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('.form-container input[type="tel"], .form-container select');
    inputs.forEach(input => {
        input.classList.add('form-input-styled');
    });

    const initialize = async () => {
        await fetchData();
        initializeCalculator();
    };
    initialize();
});

window.addEventListener('load', () => {
    const exchangeRateSelectElement = document.getElementById('exchange-rate');
    const customRateInputElement = document.getElementById('custom-rate-input');
    if (exchangeRateSelectElement && exchangeRateSelectElement.value === 'custom') {
        customRateInputElement.style.display = 'block';
    }
});

fetchData();