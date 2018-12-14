/**
 * ОПЛАТА GooglePay
 *
 * Сначала в showPaymentButtons() API GooglePay делает запрос на сервер Google, который отвечает, может ли этот браузер производить оплату. Далее показывается кнопка GooglePay
 * При нажатии на кнопку GooglePay API посылает запрос на сервер Google, открывается фрейм с сохранёнными картами, после завершения операции фрейм закрывается
 * При успешном ответе делаем запрос в бэк, передаём токен, полученный от Google
 * После успешного потверждения от бэка делаем запрос на оплату в наше API
 *
 * https://developers.google.com/pay/api/web/guides/tutorial , https://developers.google.com/pay/api/web/reference/client , https://developers.google.com/pay/api/web/reference/object
 */

/**
 * ПРОЦЕССИНГ Google Pay
 *
 * @param options.googlePayPublicKey - приходит от бэка в шаблон
 * @param options.googleBaseCardPaymentMethod - устанавливается в шаблоне либо берётся дефолтный
 * @param options.merc_id - приходит от бэка в шаблон
 * @param options.merc_name - приходит от бэка в шаблон
 */

const setGoogleBaseCardPaymentMethod = () => {
    return {
        type: "CARD",
        parameters: {
            allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
            allowedCardNetworks: ["AMEX", "DISCOVER", "JCB", "MASTERCARD", "VISA"]
        }
    }
};

const checkParams = (type, options, callbacks) => {

    // общие проверки
    if (!options) {
        console.log("Параметры для " + type + " отсутствуют");
        return false;
    }
    if (!callbacks) {
        console.log("Коллбэки для GooglePayProcessing отсутствуют");
        return false;
    }
    if (callbacks && (!callbacks.fail || typeof callbacks.fail !== "function")) {
        console.log("Коллбэк fail для " + type + " отсутствует");
        return false;
    }
    if (callbacks && (!callbacks.success || typeof callbacks.success !== "function")) {
        console.log("Коллбэк success для " + type + " отсутствует");
        return false;
    }
    // дефолтный googleBaseCardPaymentMethod для обеих функций
    if (!options.googleBaseCardPaymentMethod) {
        options.googleBaseCardPaymentMethod = setGoogleBaseCardPaymentMethod();
    }

    if (type == "GooglePayProcessing") {
        // paymentsClient должен быть создан при включении кнопки Google Pay и передан на процессинг
        if (!options.paymentsClient) {
            console.log("Передайте объект paymentsClient");
            return false;
        }
        // валюта по умолчанию рубль
        if (!options.currency) {
            options.currency = "RUB";
        }

    }
    if (type == "showGooglePayButton") {
        // по умолчанию считаем, что используем код на проде
        if (!options.environment) {
            options.environment = "PRODUCTION";
        }
        if (callbacks && (!callbacks.setPaymentClient || typeof callbacks.setPaymentClient !== "function")) {
            console.log("Коллбэк setPaymentClient для " + type + " отсутствует");
            return false;
        }
    }

    return {
        options
    }
};

export function GooglePayProcessing(options, callbacks) {

    // проверка параметров
    const check = checkParams("GooglePayProcessing", options, callbacks);
    if (!check) {
        return false;
    } else {
        options = check.options;
    }

    const token = {
        /* for demo (enviroment TEST):
            parameters: {
                "protocolVersion": "ECv1",
                "publicKey": "your test public key"
            }
        */
        /* for prod (enviroment PRODUCTION):
            parameters: {
                "protocolVersion": "ECv1",
                "publicKey": params.googlePayPublicKey
            }
        */
        type: 'DIRECT',
        parameters: {
            "protocolVersion": "ECv1",
            "publicKey": options.googlePayPublicKey
        }
    };

    const baseMethod = options.googleBaseCardPaymentMethod;

    const getGooglePaymentDataRequest = () => {
        const cardPaymentMethod = Object.assign(
            {},
            baseMethod,
            {
                tokenizationSpecification: token
            }
        );

        const paymentDataRequest = {
            apiVersion: 2,
            apiVersionMinor: 0,
            allowedPaymentMethods : [cardPaymentMethod],
            /* for demo (enviroment TEST):
                merchantInfo : {
                    merchantId: '12345678901234567890',
                    merchantName: 'JOHN SMITH'
                },
            */
            /* for prod (enviroment PRODUCTION):
                merchantInfo : {
                    merchantId: options.merc_id,
                    merchantName: options.merc_name
                },
            */
            merchantInfo : {
                merchantId: options.merc_id,
                merchantName: options.merc_name
            },
            transactionInfo : {
                currencyCode: options.currency,
                totalPriceStatus: 'FINAL',
                totalPrice: "" + options.sum
            }
        };

        return paymentDataRequest;
    };

    // объект уже был создан при проверке возможности оплаты и включении кнопки
    const paymentsClient = options.paymentsClient;
    const paymentDataRequest = getGooglePaymentDataRequest();

    // GooglePay API посылает запрос на сервер Google, открывается фрейм с сохранёнными картами, после завершения операции фрейм закрывается
    paymentsClient.loadPaymentData(paymentDataRequest)
        .then(function(paymentData) {
            const googleToken = JSON.parse(paymentData.paymentMethodData.tokenizationData.token);

            // примерный запрос клиент-сервер, обязательно нужно передать googleToken и googlePayPublicKey
            $.ajax({
                url: options.request_url + "?form_request_id=" + options.form_request_id,
                method: 'POST',
                dataType: "json",
                data: JSON.stringify({
                    googleToken,
                    pub_key: options.googlePayPublicKey,
                    link_id: options.link_id,
                    sum: options.sum,
                    refill_id: options.refill_id,
                    apikey: options.apikey,
                    client_id: options.client_id
                }),

                success: (response) => {
                    if (response.code != undefined && response.code == "0") {
                        callbacks.success();                        
                    } else {
                        console.log("Запрос на оплату закончился неудачно");
                        callbacks.fail();
                    }
                },
                error: () => {
                    console.log("Запрос на оплату закончился неудачно");
                    callbacks.fail();
                }
            })

        })
        .catch(function(err) {
            // сообщение об ошибке отображается во фрейме оплаты автоматически
            console.log("GooglePayProcessing ERROR");
            console.error(err);
        });
}

/**
 * ПОКАЗ КНОПКИ Google Pay
 *
 * @param options - здесь передаём googleBaseCardPaymentMethod, environment
 * @param callbacks - здесь передаём коллбэк успеха, неуспеха, а также сеттер для запоминания экземпляра платёжного клиента
 */
export function showGooglePayButton(options, callbacks) {
    // проверка параметров
    const check = checkParams("showGooglePayButton", options, callbacks);
    if (!check) {
        return false;
    } else {
        options = check.options;
    }

    const paymentsClient = new google.payments.api.PaymentsClient({environment: options.environment});
    // в приложении запоминаем экземпляр платёжного клиента, который создало API
    callbacks.setPaymentClient(paymentsClient);
    const request = {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [options.googleBaseCardPaymentMethod]
    };
    paymentsClient.isReadyToPay(request)
        .then(function(response) {
            if (response.result) {
                callbacks.success();
                return true;
            } else {
                console.log("Запрос на показ кнопки Google Pay закончился неудачно");
                callbacks.fail();
            }
        })
        .catch(function(err) {
            console.log("showGooglePayButton ERROR");
            callbacks.fail();
        });
}