export class MockClient {
    // onUpdateCallback — это функция, которую мы передадим из Контроллера
    constructor(onUpdateCallback) {
        this.onUpdate = onUpdateCallback;
        this.intervalId = null;
    }

    startSimulation() {
        // setInterval — запускает бесконечный цикл с паузой в 1000 мс (1 секунда)
        this.intervalId = setInterval(() => {
            this.tick();
        }, 1000);
    }

    tick() {
        // В будущем здесь будет логика прироста ресурсов у захваченных узлов[cite: 1]
        
        // Сообщаем Контроллеру, что данные изменились и нужен рендер
        if (this.onUpdate) {
            this.onUpdate();
        }
    }

    // Имитация отправки данных на сервер при взломе
    simulateAttack(kLevel, isSuccess) {
        return new Promise((resolve) => {
            // setTimeout — искусственная задержка сети (500 мс)
            setTimeout(() => {
                // Расчет очков: K*5 за успех, штраф K*3 за провал[cite: 1]
                const points = isSuccess ? kLevel * 5 : -(kLevel * 3); 
                resolve({ success: isSuccess, pointsDelta: points });
            }, 500); 
        });
    }
}