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
        // Agregar el símbolo al lado izquierdo del precio
        elements.price.innerHTML = `${monitor.symbol} ${formattedPrice} Bs`;
    }
    if (elements.lastUpdate) elements.lastUpdate.textContent = monitor.last_update;
    if (elements.oldPrice) {
        const formattedOldPrice = formatVenezuelanCurrency(monitor.price_old);
        elements.oldPrice.textContent = `Anterior: Bs ${formattedOldPrice}`;
    }

    if (elements.change && elements.percentage) {
        const sign = monitor.color === 'green' ? '+' : '-';
        elements.change.innerHTML = `<span class="math-inline">${sign}</span>${monitor.change}`;
        elements.percentage.innerHTML = `<span class="math-inline">${sign}</span>${monitor.percent}%`;

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
let customRateError = document.getElementById('custom-rate-error');

function handleInputValue(inputElement, errorElement) {
    let value = inputElement.value;
    const hasComma = value.includes(',');
    const hasDot = value.includes('.');
    const allowedChars = /^[0-9]*([.,]{0,1}[0-9]*)?$/;

    // Validar caracteres permitidos
    if (!allowedChars.test(value)) {
        inputElement.classList.add('invalid');
        inputElement.value = value.slice(0, -1);
        errorElement.textContent = 'Caracter no permitido';
        return;
    }

    // Validar si hay más de un separador decimal
    if (hasComma && hasDot) {
        inputElement.classList.add('invalid');
        inputElement.value = value.slice(0, -1);
        errorElement.textContent = 'Solo puede usar un separador decimal';
        return;
    }

    // Normalizar el valor
    inputElement.classList.remove('invalid');
    if (hasDot && !hasComma) {
        value = value.replace('.', ',');
    }

    const parts = value.split(',');
    if (parts.length > 1 && parts[1].length > 2) {
        inputElement.classList.add('invalid');
        inputElement.value = parts[0] + ',' + parts[1].slice(0, 2);
        errorElement.textContent = 'Máximo 2 decimales';
        return;
    }

    // Limitar longitud
    if (value.replace(/[^0-9,]/g, '').length > 15) {
        const beforeDecimal = value.split(',')[0] || '';
        inputElement.value = beforeDecimal.slice(0, 15) + (parts.length > 1 ? ',' + parts[1] : '');
        errorElement.textContent = 'Demasiados dígitos';
    } else {
        errorElement.textContent = ''; // Limpiar mensaje si válido
        inputElement.value = value;
    }
    
    // Validar si no hay error y proceder con la conversión
    if (inputElement.classList.contains('invalid')) {
        return;
    }

    // Llamar a la conversión si el valor es válido
    convertCurrency();
}



amountInput.addEventListener('input', function() {
    handleInputValue(this, amountError);
});

customRateInput.addEventListener('input', function() {
    handleInputValue(this, customRateError);
});

amountInput.addEventListener('paste', function(event) {
    event.preventDefault();
    const pastedText = (event.clipboardData || window.clipboardData).getData('text');
    const cleanedText = pastedText.replace(/[^0-9.,]/g, '');
    const lastSeparatorIndex = Math.max(cleanedText.lastIndexOf(','), cleanedText.lastIndexOf('.'));
    let finalValue = '';
    if (lastSeparatorIndex !== -1) {
        const integerPart = cleanedText.substring(0, lastSeparatorIndex).replace(/[.,]/g, '');
        const decimalPart = cleanedText.substring(lastSeparatorIndex + 1).replace(/[^0-9]/g, '');
        const separator = cleanedText[lastSeparatorIndex] === '.' ? ',' : cleanedText[lastSeparatorIndex];
        finalValue = integerPart + separator + decimalPart;
    } else {
        finalValue = cleanedText.replace(/[^0-9]/g, '');
    }
    const parts = finalValue.split(',');
    if (parts.length > 1) {
        parts[1] = parts[1].slice(0, 2);
        finalValue = parts.join(',');
    }
    const numericPart = finalValue.replace(/[^0-9]/g, '');
    if (numericPart.length > 15) {
        const integerLength = parts[0]?.length || 0;
        const maxIntegerLength = 15 - (parts.length > 1 ? parts[1].length : 0);
        if (integerLength > maxIntegerLength) {
            parts[0] = parts[0].slice(0, maxIntegerLength);
            finalValue = parts.join(',');
        }
    }
    this.value = finalValue;
    // Validar el valor pegado para agregar o remover la clase 'invalid'
    const isValidPaste = /^[0-9]*([.,]{0,1}[0-9]{0,2})?$/.test(this.value) && !(this.value.includes(',') && this.value.includes('.'));
    if (!isValidPaste) {
        this.classList.add('invalid');
        setTimeout(() => this.classList.remove('invalid'), 500); // Remover la clase después de un breve tiempo
    } else {
        this.classList.remove('invalid');
        this.dispatchEvent(new Event('input'));
    }
});

customRateInput.addEventListener('paste', function(event) {
    event.preventDefault();
    const pastedText = (event.clipboardData || window.clipboardData).getData('text');
    const cleanedText = pastedText.replace(/[^0-9.,]/g, '');
    const lastSeparatorIndex = Math.max(cleanedText.lastIndexOf(','), cleanedText.lastIndexOf('.'));
    let finalValue = '';
    if (lastSeparatorIndex !== -1) {
        const integerPart = cleanedText.substring(0, lastSeparatorIndex).replace(/[.,]/g, '');
        const decimalPart = cleanedText.substring(lastSeparatorIndex + 1).replace(/[^0-9]/g, '');
        const separator = cleanedText[lastSeparatorIndex] === '.' ? ',' : cleanedText[lastSeparatorIndex];
        finalValue = integerPart + separator + decimalPart;
    } else {
        finalValue = cleanedText.replace(/[^0-9]/g, '');
    }
    const parts = finalValue.split(',');
    if (parts.length > 1) {
        parts[1] = parts[1].slice(0, 2);
        finalValue = parts.join(',');
    }
    const numericPart = finalValue.replace(/[^0-9]/g, '');
    if (numericPart.length > 15) {
        const integerLength = parts[0]?.length || 0;
        const maxIntegerLength = 15 - (parts.length > 1 ? parts[1].length : 0);
        if (integerLength > maxIntegerLength) {
            parts[0] = parts[0].slice(0, maxIntegerLength);
            finalValue = parts.join(',');
        }
    }
    this.value = finalValue;
    // Validar el valor pegado para agregar o remover la clase 'invalid'
    const isValidPaste = /^[0-9]*([.,]{0,1}[0-9]{0,2})?$/.test(this.value) && !(this.value.includes(',') && this.value.includes('.'));
    if (!isValidPaste) {
        this.classList.add('invalid');
        setTimeout(() => this.classList.remove('invalid'), 500); // Remover la clase después de un breve tiempo
    } else {
        this.classList.remove('invalid');
        this.dispatchEvent(new Event('input'));
    }
});

function convertCurrency() {
    const amountInputValue = amountInput.value;
    const customRateInputValue = customRateInput.value;
    const normalizedAmount = amountInputValue.replace(',', '.');
    const normalizedCustomRate = customRateInputValue.replace(',', '.');
    const amount = parseFloat(normalizedAmount);
    const currencyType = currencyTypeSelect.value;
    const selectedRateType = exchangeRateSelect.value;
    let rate = null;

    const amountInputElem = document.getElementById('amount');
    const customRateInputElem = document.getElementById('custom-rate');

    amountInputElem.classList.remove('invalid');
    customRateInputElem.classList.remove('invalid');

    if (isNaN(amount) && amountInputValue.trim() !== '') {
        amountInputElem.classList.add('invalid');
        amountError.textContent = 'Ingrese una cantidad válida.';
        conversionResult.textContent = '0,00';
        copyBtn.style.display = 'none';
        return;
    } else if (amount <= 0 && amountInputValue.trim() !== '') {
        amountInputElem.classList.add('invalid');
        amountError.textContent = 'La cantidad debe ser mayor que cero.';
        conversionResult.textContent = '0,00';
        copyBtn.style.display = 'none';
        return;
    } else if (amountInputValue.trim() === '') {
        amountError.textContent = '';
        conversionResult.textContent = '0,00';
        copyBtn.style.display = 'none';
    }

    if (selectedRateType === 'custom') {
        rate = parseFloat(normalizedCustomRate);
        if (isNaN(rate) && customRateInputValue.trim() !== '') {
            if (customRateError) customRateError.textContent = 'Ingrese una tasa personalizada válida.';
            customRateInputElem.classList.add('invalid');
            conversionResult.textContent = '0,00';
            copyBtn.style.display = 'none';
            return;
        } else if (rate <= 0 && customRateInputValue.trim() !== '') {
            if (customRateError) customRateError.textContent = 'La tasa debe ser mayor que cero.';
            customRateInputElem.classList.add('invalid');
            conversionResult.textContent = '0,00';
            copyBtn.style.display = 'none';
            return;
        } else if (customRateInputValue.trim() === '') {
            if (customRateError) customRateError.textContent = '';
            conversionResult.textContent = '0,00';
            copyBtn.style.display = 'none';
        }
    } else {
        // Asignar la tasa correspondiente según la selección del usuario
        switch (selectedRateType) {
            case 'bcv':
                rate = bcvRate;
                break;
            case 'enparalelovzla':
                rate = enparalelovzlaRate;
                break;
            case 'promedio':
                rate = promedioRate;
                break;
            default:
                rate = null;
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
        customRateInput.classList.remove('invalid');
    }
    convertCurrency();
});

currencyTypeSelect.addEventListener('change', convertCurrency);

copyBtn.addEventListener('click', function() {
    let textToCopy = conversionResult.textContent.split(' ')[0];
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            console.log('Copiado exitoso');
            copyMessage.textContent = '¡Copiado!';
            copyMessage.classList.remove('error');
            copyMessage.classList.add('show');
            setTimeout(() => {
                copyMessage.classList.remove('show');
            }, 2000);
        })
        .catch(err => {
            console.error('Error al copiar al portapapeles:', err);
            console.log('Error al copiar');
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
    amountInput.classList.remove('invalid');
    customRateInput.classList.remove('invalid');

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