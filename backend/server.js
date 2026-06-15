const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json()); // Ось цей рядок розпаковує дані кошика!
const PORT = 3000;

// Вказуємо точний шлях до папки frontend (вона на рівень вище від backend)
const frontendPath = path.join(__dirname, '../frontend');

// Роздаємо статичні файли (щоб працювали картинки з папки images)
app.use(express.static(frontendPath));

// Головна сторінка: коли хтось заходить на сайт, віддаємо HTML з папки frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'gastro_intelligence_website.html'));
});

// Шляхи до баз даних (всі файли в папці data)
const dataPath = path.join(__dirname, 'data', 'locations.json');
const productsPath = path.join(__dirname, 'data', 'products.json');
const messagesPath = path.join(__dirname, 'data', 'messages.json');
const ordersPath = path.join(__dirname, 'data', 'orders.json'); 

// ==========================================
// 📍 МАРШРУТИ ЛОКАЦІЙ
// ==========================================
app.get('/api/locations', (req, res) => {
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Помилка сервера" });
        res.json(data ? JSON.parse(data) : []);
    });
});

app.post('/api/locations', (req, res) => {
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Помилка сервера" });
        const locations = data ? JSON.parse(data) : [];
        const newLocation = { id: "loc_" + Date.now(), ...req.body };
        locations.push(newLocation);
        fs.writeFile(dataPath, JSON.stringify(locations, null, 2), err => {
            if (err) return res.status(500).json({ error: "Помилка збереження" });
            res.status(200).json({ success: true });
        });
    });
});

app.put('/api/locations/:id', (req, res) => {
  fs.readFile(dataPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Помилка сервера');
    let locations = JSON.parse(data || '[]');
    const index = locations.findIndex(l => l.id === req.params.id);
    if (index !== -1) {
      locations[index] = { ...locations[index], ...req.body, id: req.params.id };
      fs.writeFile(dataPath, JSON.stringify(locations, null, 2), () => res.send({ success: true }));
    } else res.status(404).send('Локацію не знайдено');
  });
});

app.delete('/api/locations/:id', (req, res) => {
  fs.readFile(dataPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Помилка сервера');
    let locations = JSON.parse(data || '[]');
    locations = locations.filter(l => l.id !== req.params.id);
    fs.writeFile(dataPath, JSON.stringify(locations, null, 2), () => res.send({ success: true }));
  });
});

// ==========================================
// 📦 МАРШРУТИ ТОВАРІВ (CRUD)
// ==========================================
app.get('/api/products', (req, res) => {
    fs.readFile(productsPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Помилка читання" });
        res.json(data ? JSON.parse(data) : []);
    });
});

app.post('/api/products', (req, res) => {
    fs.readFile(productsPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Помилка сервера" });
        const products = data ? JSON.parse(data) : [];
        const newProduct = { id: Date.now().toString(), ...req.body };
        products.push(newProduct);
        fs.writeFile(productsPath, JSON.stringify(products, null, 2), err => {
            if (err) return res.status(500).json({ error: "Помилка збереження" });
            res.status(200).json({ success: true });
        });
    });
});

app.put('/api/products/:id', (req, res) => {
  fs.readFile(productsPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Помилка сервера');
    let products = JSON.parse(data || '[]');
    const index = products.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
      products[index] = { ...products[index], ...req.body, id: req.params.id };
      fs.writeFile(productsPath, JSON.stringify(products, null, 2), (err) => {
        if (err) return res.status(500).send('Помилка збереження');
        res.send({ success: true });
      });
    } else {
      res.status(404).send('Товар не знайдено');
    }
  });
});

app.delete('/api/products/:id', (req, res) => {
  fs.readFile(productsPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Помилка сервера');
    let products = JSON.parse(data || '[]');
    const filteredProducts = products.filter(p => p.id !== req.params.id);
    fs.writeFile(productsPath, JSON.stringify(filteredProducts, null, 2), (err) => {
      if (err) return res.status(500).send('Помилка видалення');
      res.send({ success: true });
    });
  });
});

// ==========================================
// 🛒 МАРШРУТИ ЗАМОВЛЕНЬ
// ==========================================
app.get('/api/orders', (req, res) => {
    fs.readFile(ordersPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Помилка читання" });
        res.json(data ? JSON.parse(data) : []);
    });
});

app.post('/api/orders', (req, res) => {
    fs.readFile(ordersPath, 'utf8', async (err, data) => {
        if (err) return res.status(500).json({ error: "Помилка сервера" });
        const orders = data ? JSON.parse(data) : [];
        const newOrder = { id: "ord_" + Date.now(), date: new Date().toISOString(), ...req.body };
        orders.unshift(newOrder); 
        
        fs.writeFile(ordersPath, JSON.stringify(orders, null, 2), async (err) => {
            if (err) return res.status(500).json({ error: "Помилка збереження" });
            
            // 👇 ВІДПРАВКА В ТЕЛЕГРАМ 👇
            const telegramMsg = `🚨 <b>НОВЕ ЗАМОВЛЕННЯ!</b>\n\n👤 <b>Клієнт:</b> ${newOrder.name}\n📞 <b>Телефон:</b> ${newOrder.phone}\n🛒 <b>Товари:</b> ${newOrder.product}\n💰 <b>Сума:</b> ${newOrder.price} грн`;
            await sendTelegramNotification(telegramMsg);

            res.status(200).json({ success: true });
        });
    });
});

app.put('/api/orders/:id', (req, res) => {
  fs.readFile(ordersPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Помилка сервера');
    let orders = JSON.parse(data || '[]');
    const index = orders.findIndex(o => o.id === req.params.id);
    if (index !== -1) {
      orders[index].status = req.body.status; 
      fs.writeFile(ordersPath, JSON.stringify(orders, null, 2), (err) => {
        if (err) return res.status(500).send('Помилка збереження статусу');
        res.send({ success: true });
      });
    } else {
      res.status(404).send('Замовлення не знайдено');
    }
  });
});

app.delete('/api/orders/:id', (req, res) => {
  fs.readFile(ordersPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Помилка сервера');
    let orders = JSON.parse(data || '[]');
    const filteredOrders = orders.filter(o => o.id !== req.params.id);
    fs.writeFile(ordersPath, JSON.stringify(filteredOrders, null, 2), (err) => {
      if (err) return res.status(500).send('Помилка видалення замовлення');
      res.send({ success: true });
    });
  });
});

// ==========================================
// ✉️ МАРШРУТИ ПОВІДОМЛЕНЬ
// ==========================================
app.get('/api/messages', (req, res) => {
    fs.readFile(messagesPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Помилка читання" });
        res.json(data ? JSON.parse(data) : []);
    });
});
app.post('/api/contact', (req, res) => {
    // Використовуємо твій старий перевірений messagesPath
    fs.readFile(messagesPath, 'utf8', async (err, data) => {
        if (err) return res.status(500).json({ error: "Помилка читання бази" });

        const messages = data ? JSON.parse(data) : [];
        const newMsg = { id: Date.now().toString(), date: new Date().toISOString(), ...req.body };
        messages.push(newMsg);

        // Зберігаємо файл
        fs.writeFile(messagesPath, JSON.stringify(messages, null, 2), async (err) => {
            if (err) return res.status(500).json({ error: "Помилка збереження" });

            // Відправляємо в Телеграм тільки якщо файл успішно зберігся
            try {
                const telegramMsg = `✉️ <b>НОВЕ ПОВІДОМЛЕННЯ (${newMsg.type})</b>\n\n👤 <b>Від:</b> ${newMsg.name} (${newMsg.phone})\n🏢 <b>Локація:</b> ${newMsg.business || 'Не вказано'}\n💬 <b>Текст:</b> <i>${newMsg.message}</i>`;
                await sendTelegramNotification(telegramMsg);
            } catch (tgError) {
                console.log("Помилка відправки в Телеграм:", tgError);
            }

            // Відповідаємо браузеру, що все супер
            res.status(200).json({ success: true });
        });
    });
});

// Видалення повідомлення
app.delete('/api/messages/:id', (req, res) => {
    const messageId = req.params.id;

    // Читаємо базу старим надійним методом
    fs.readFile(messagesPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Помилка читання бази" });

        let messages = data ? JSON.parse(data) : [];
        
        // Видаляємо потрібне повідомлення
        messages = messages.filter(msg => msg.id.toString() !== messageId.toString());

        // Зберігаємо файл
        fs.writeFile(messagesPath, JSON.stringify(messages, null, 2), (err) => {
            if (err) return res.status(500).json({ error: "Помилка збереження" });
            
            // Якщо все ок — відповідаємо успіхом
            res.status(200).json({ success: true });
        });
    });
});

app.delete('/api/messages/:id', (req, res) => {
  fs.readFile(messagesPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Помилка сервера');
    let msgs = JSON.parse(data || '[]');
    msgs = msgs.filter(m => m.id.toString() !== req.params.id);
    fs.writeFile(messagesPath, JSON.stringify(msgs, null, 2), () => res.send({ success: true }));
  });
});

// ==========================================
// 🧠 ІНТЕЛЕКТУАЛЬНИЙ МОДУЛЬ (ШТУЧНИЙ ІНТЕЛЕКТ)
// ==========================================
app.post('/api/generate-desc', async (req, res) => {
    const { name, category } = req.body;
    
    // Твій дійсний ключ збережено
    const apiKey = process.env.GEMINI_API_KEY; 
    
    const prompt = `Ти досвідчений гастрономічний експерт та маркетолог Рівненщини. Напиши апетитний, продаючий опис для крафтового продукту. 
    Назва: "${name}". Категорія: "${category}". 
    Опис має бути українською мовою, складатись з 3-4 речень. Підкресли автентичність, традиції Полісся та натуральність. Пиши звичайним текстом без форматування (без зірочок і жирного шрифту).`;

    try {
        // ВИПРАВЛЕННЯ: Використовуємо стабільний API v1 та точну назву моделі gemini-1.5-flash
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error("❌ Деталі помилки від Google:", data);
            return res.status(500).json({ error: data.error?.message || "Помилка API Google" });
        }

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            const aiText = data.candidates[0].content.parts[0].text;
            res.json({ description: aiText });
        } else {
            throw new Error("Неочікуваний формат відповіді");
        }
    } catch (error) {
        console.error("❌ Помилка сервера:", error);
        res.status(500).json({ error: "Не вдалося згенерувати опис" });
    }
});

// --- НАЛАШТУВАННЯ TELEGRAM CRM ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramNotification(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'HTML' // Дозволяє робити текст жирним або курсивом
      })
    });
  } catch (error) {
    console.error('Помилка відправки в Telegram:', error);
  }
}

// ==========================================
// 💬 МАРШРУТ ДЛЯ AI-ГІДА (ЧАТ-БОТ)
// ==========================================
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    
    // Твій перевірений робочий API ключ
    const apiKey = process.env.GEMINI_API_KEY;

    try {
        // Зчитуємо актуальну базу даних локацій та товарів для контексту ШІ
        const locationsData = fs.existsSync(dataPath) ? fs.readFileSync(dataPath, 'utf8') : '[]';
        const productsData = fs.existsSync(productsPath) ? fs.readFileSync(productsPath, 'utf8') : '[]';

        // Формуємо детальну інструкцію (контекст) для ШІ
        const systemInstruction = `Ти — привітний штучний інтелект GastroIntel, персональний гастро-гід та експерт з кулінарних традицій Рівненщини та Полісся.
        Твоє завдання — допомагати туристам та жителям знаходити найкращі місця для відпочинку та купувати крафтові продукти (особливо поліський мацик).
        
        Ось актуальна база даних нашого сайту:
        ЛОКАЦІЇ (Ресторани, кафе, ферми, маршрути):
        ${locationsData}
        
        ТОВАРИ (Крафтові продукти, мацики, сири):
        ${productsData}
        
        ПРАВИЛА СПІЛКУВАННЯ:
        1. Спілкуйся виключно українською мовою, дуже ввічливо, гостинно та апетитно.
        2. Рекомендуй заклади, маршрути та товари ТІЛЬКИ з наданої вище бази даних. Якщо закладу чи продукту немає в базі, м'яко скажи, що платформа постійно розвивається і ми додамо його згодом.
        3. Якщо рекомендуєш товар (наприклад, мацик), обов'язково згадай, що його можна замовити прямо у нас на сайті в розділі "Крафтові продукти".
        4. Відповідай чітко, лаконічно (до 3-4 речень або компактним красивим списком), не використовуй складного форматування Markdown (без зірочок, пиши звичайним текстом).`;

        const prompt = `${systemInstruction}\n\nКористувач запитує: "${message}"\nВідповідь Гіда:`;

        // Стукаємо на твій перевірений робочий ендпоінт gemini-2.5-flash
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ Помилка AI-Гіда від Google:", data);
            return res.status(500).json({ error: "Помилка відповіді нейромережі" });
        }

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            res.json({ reply: data.candidates[0].content.parts[0].text.trim() });
        } else {
            throw new Error("Неочікуваний формат відповіді");
        }
    } catch (error) {
        console.error("❌ Помилка сервера в чаті:", error);
        res.status(500).json({ error: "Не вдалося отримати відповідь від Гіда" });
    }
});

// ==========================================
// 🧠 AI-АНАЛІТИК (РОЗРАХУНОК РЕЙТИНГУ)
// ==========================================
app.post('/api/analyze-reviews', async (req, res) => {
    const { reviews } = req.body;
    
    // Твій робочий API ключ
    const apiKey = process.env.GEMINI_API_KEY; 

    // Спеціальний промпт, який змушує ШІ видати тільки одну цифру
    const prompt = `Ти - об'єктивний гастрономічний критик та аналітик. Твоє завдання: проаналізувати тональність наступних відгуків про заклад і виставити йому загальний справедливий рейтинг від 1.0 до 10.0.
    Відгуки: "${reviews}"
    УВАГА: Твоя відповідь має містити ТІЛЬКИ ОДНЕ ЧИСЛО (наприклад, 8.5 або 9.2) без жодних додаткових слів, символів чи пояснень.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const data = await response.json();
        
        if (!response.ok) return res.status(500).json({ error: "Помилка API" });

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            const aiRating = data.candidates[0].content.parts[0].text.trim();
            res.json({ rating: aiRating });
        } else {
            throw new Error("Неочікуваний формат");
        }
    } catch (error) {
        console.error("Помилка аналітика:", error);
        res.status(500).json({ error: "Не вдалося розрахувати рейтинг" });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер успішно запущено на http://localhost:${PORT}`);
});