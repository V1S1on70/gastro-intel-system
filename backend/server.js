const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json()); 
const PORT = process.env.PORT || 3000;

// Підключення до бази даних Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Налаштування multer для прийому фотографій товарів
const upload = multer({ storage: multer.memoryStorage() });

// Вказуємо точний шлях до папки frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Головна сторінка
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'gastro_intelligence_website.html'));
});

// --- НАЛАШТУВАННЯ TELEGRAM ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramNotification(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: 'HTML' })
    });
  } catch (error) {
    console.error('Помилка відправки в Telegram:', error);
  }
}

// ==========================================
// 📍 МАРШРУТИ ЛОКАЦІЙ (Оновлено: додано підтримку фото)
// ==========================================
app.get('/api/locations', async (req, res) => {
    const { data, error } = await supabase.from('locations').select('*').order('id', { ascending: false });
    if (error) return res.status(500).json({ error: "Помилка сервера", details: error.message });
    res.json(data);
});

// СТВОРЕННЯ ЛОКАЦІЇ З ФОТО
app.post('/api/locations', upload.single('image'), async (req, res) => {
    try {
        const { name, category, city, latitude, longitude, ai_rating, price_range, description, tag } = req.body;
        let imageUrl = ''; // Сюди запишемо посилання на фото

        // Якщо користувач прикріпив файл фотографії
        if (req.file) {
            const file = req.file;
            const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
            const { error: uploadError } = await supabase.storage
                .from('locations') // Завантажуємо у нове сховище "locations"
                .upload(fileName, file.buffer, { contentType: file.mimetype });

            if (uploadError) throw uploadError;

            // Отримуємо публічне посилання на фото
            const { data: urlData } = supabase.storage.from('locations').getPublicUrl(fileName);
            imageUrl = urlData.publicUrl;
        }

        const { error: dbError } = await supabase
            .from('locations')
            .insert([{
                name,
                category,
                city,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                ai_rating: parseFloat(ai_rating) || 0,
                price_range,
                description,
                tag: tag || '',
                image_url: imageUrl
            }]);

        if (dbError) throw dbError;
        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка збереження", details: err.message });
    }
});

// РЕДАГУВАННЯ ЛОКАЦІЇ З ФОТО
app.put('/api/locations/:id', upload.single('image'), async (req, res) => {
    try {
        const { name, category, city, latitude, longitude, ai_rating, price_range, description, tag } = req.body;

        let updateData = {
            name,
            category,
            city,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            ai_rating: parseFloat(ai_rating) || 0,
            price_range,
            description,
            tag: tag || ''
        };

        // Якщо обрали НОВЕ фото під час редагування
        if (req.file) {
            const file = req.file;
            const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
            const { error: uploadError } = await supabase.storage
                .from('locations')
                .upload(fileName, file.buffer, { contentType: file.mimetype });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('locations').getPublicUrl(fileName);
            updateData.image_url = urlData.publicUrl; // Оновлюємо посилання
        }

        const { error: dbError } = await supabase
            .from('locations')
            .update(updateData)
            .eq('id', req.params.id);

        if (dbError) throw dbError;
        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка оновлення", details: err.message });
    }
});

app.delete('/api/locations/:id', async (req, res) => {
    try {
        const locId = parseInt(req.params.id);
        const { error } = await supabase.from('locations').delete().eq('id', locId);
        if (error) throw error;
        res.status(200).json({ success: true });
    } catch (err) {
        console.error("❌ Серверна помилка видалення:", err.message);
        res.status(500).json({ error: "Помилка видалення", details: err.message });
    }
});

// ==========================================
// 📦 МАРШРУТИ ТОВАРІВ
// ==========================================
app.get('/api/products', async (req, res) => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) return res.status(500).json({ error: "Помилка читання", details: error.message });
    res.json(data);
});

app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        const file = req.file;
        // Читаємо правильні поля (manufacturer та tag)
        const { name, description, price, category, manufacturer, weight, tag } = req.body;

        if (!file) return res.status(400).json({ error: 'Потрібне фото' });

        const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
        const { error: uploadError } = await supabase.storage
            .from('products')
            .upload(fileName, file.buffer, { contentType: file.mimetype });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('products').getPublicUrl(fileName);
        const imageUrl = urlData.publicUrl;

        const { error: dbError } = await supabase
            .from('products')
            .insert([{ 
                name, 
                description, 
                price: parseFloat(price), 
                image_url: imageUrl,
                category,
                manufacturer: manufacturer || 'ФОП Балдич', // Записуємо в правильну колонку
                weight,
                tag: tag || '' // Записуємо як звичайний текст, а не масив
            }]);

        if (dbError) throw dbError;

        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка збереження", details: err.message });
    }
});

app.put('/api/products/:id', upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, category, manufacturer, weight, tag } = req.body;
        
        // Базові дані для оновлення (без фото)
        let updateData = {
            name, 
            description, 
            price: parseFloat(price), 
            category, 
            manufacturer: manufacturer || 'ФОП Балдич', 
            weight, 
            tag: tag || ''
        };

        // Якщо користувач обрав НОВЕ фото під час редагування
        if (req.file) {
            const file = req.file;
            const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
            const { error: uploadError } = await supabase.storage
                .from('products')
                .upload(fileName, file.buffer, { contentType: file.mimetype });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('products').getPublicUrl(fileName);
            updateData.image_url = urlData.publicUrl; // Додаємо нове посилання до оновлення
        }

        const { error: dbError } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', req.params.id);

        if (dbError) throw dbError;

        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка оновлення", details: err.message });
    }
});
app.delete('/api/products/:id', async (req, res) => {
    try {
        // Перетворюємо текстовий ID з URL на строге число для бази даних
        const productId = parseInt(req.params.id);
        
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);
            
        if (error) {
            console.error("❌ Помилка БД при видаленні:", error.message);
            throw error;
        }
        
        res.status(200).json({ success: true });
    } catch (err) {
        console.error("❌ Серверна помилка видалення:", err.message);
        res.status(500).json({ error: "Помилка видалення", details: err.message });
    }
});
// ==========================================
// 🛒 МАРШРУТИ ЗАМОВЛЕНЬ
// ==========================================
app.get('/api/orders', async (req, res) => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: "Помилка читання" });
    res.json(data);
});

app.post('/api/orders', async (req, res) => {
    try {
        const { customer, items, totalAmount, status } = req.body;

        // 1. Запис у базу даних Supabase (використовуємо твої реальні колонки!)
        const { data, error } = await supabase
            .from('orders')
            .insert([{
                customer_name: customer.name,
                customer_phone: customer.phone,
                customer_address: "Не вказано",
                items: items, 
                total_price: totalAmount,
                status: status || 'Нове'
            }]);

        if (error) {
            console.error("❌ Помилка запису в Supabase:", error.message);
            throw new Error("Не вдалося зберегти в БД");
        }

        // 2. Відправка в Telegram через твою існуючу функцію
        const message = `🔥 <b>НОВЕ ЗАМОВЛЕННЯ!</b>\n\n👤 <b>Клієнт:</b> ${customer.name}\n📞 <b>Телефон:</b> ${customer.phone}\n🛒 <b>Товари:</b> ${items}\n💰 <b>Сума:</b> ${totalAmount} грн`;
        
        await sendTelegramNotification(message);

        // Повертаємо клієнту статус успіху
        res.status(200).json({ success: true, message: 'Замовлення успішно оформлено' });

    } catch (error) {
        console.error('❌ Критична помилка обробки замовлення:', error);
        res.status(500).json({ error: 'Внутрішня помилка сервера' });
    }
});

app.put('/api/orders/:id', async (req, res) => {
    const { error } = await supabase.from('orders').update({ status: req.body.status }).eq('id', req.params.id);
    if (error) return res.status(500).send('Помилка оновлення статусу');
    res.send({ success: true });
});

app.delete('/api/orders/:id', async (req, res) => {
    const { error } = await supabase.from('orders').delete().eq('id', req.params.id);
    if (error) return res.status(500).send('Помилка видалення');
    res.send({ success: true });
});

// ==========================================
// ✉️ МАРШРУТИ ПОВІДОМЛЕНЬ
// ==========================================
app.get('/api/messages', async (req, res) => {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: "Помилка читання" });
    res.json(data);
});

app.post('/api/contact', async (req, res) => {
    try {
        const { name, phone, email, business, message, type } = req.body;

        const { error } = await supabase.from('messages').insert([{ 
            name: name, 
            email: email || phone, 
            message: `[${type}] ${business || 'Не вказано'} - ${message}`
        }]);

        if (error) throw error;

        const telegramMsg = `✉️ <b>НОВЕ ПОВІДОМЛЕННЯ (${type})</b>\n\n👤 <b>Від:</b> ${name} (${phone})\n🏢 <b>Локація:</b> ${business || 'Не вказано'}\n💬 <b>Текст:</b> <i>${message}</i>`;
        await sendTelegramNotification(telegramMsg);

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Помилка збереження" });
    }
});

app.delete('/api/messages/:id', async (req, res) => {
    const { error } = await supabase.from('messages').delete().eq('id', req.params.id);
    if (error) return res.status(500).send('Помилка сервера');
    res.send({ success: true });
});

// ==========================================
// 🧠 ІНТЕЛЕКТУАЛЬНИЙ МОДУЛЬ (ШТУЧНИЙ ІНТЕЛЕКТ)
// ==========================================
app.post('/api/generate-desc', async (req, res) => {
    const { name, category } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; 
    
    const prompt = `Ти досвідчений гастрономічний експерт та маркетолог Рівненщини. Напиши апетитний, продаючий опис для крафтового продукту. 
    Назва: "${name}". Категорія: "${category}". 
    Опис має бути українською мовою, складатись з 3-4 речень. Підкресли автентичність, традиції Полісся та натуральність. Пиши звичайним текстом без форматування (без зірочок і жирного шрифту).`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            res.json({ description: data.candidates[0].content.parts[0].text });
        } else {
            res.status(500).json({ error: "Помилка API Google" });
        }
    } catch (error) {
        res.status(500).json({ error: "Не вдалося згенерувати опис" });
    }
});

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    try {
        // ОБОВ'ЯЗКОВО беремо 'id' з бази, щоб бот міг створювати кнопки
        const { data: locations } = await supabase.from('locations').select('id, name, description');
        const { data: products } = await supabase.from('products').select('id, name, description, price');

        const systemInstruction = `Ти — привітний штучний інтелект GastroIntel, персональний гастро-гід та експерт з кулінарних традицій Рівненщини та Полісся.
        Ось актуальна база даних нашого сайту:
        ЛОКАЦІЇ (з ID): ${JSON.stringify(locations)}
        ТОВАРИ (з ID): ${JSON.stringify(products)}
        
        ПРАВИЛА СПІЛКУВАННЯ:
        1. Спілкуйся виключно українською мовою, гостинно та лаконічно (до 3-4 речень).
        2. Рекомендуй заклади та товари ТІЛЬКИ з наданої вище бази даних.
        3. ІНТЕРАКТИВНІ КНОПКИ (ДУЖЕ ВАЖЛИВО!):
           - Якщо ти рекомендуєш ТОВАР (наприклад, мацик), ти ЗОБОВ'ЯЗАНИЙ додати в кінці повідомлення тег у форматі [CART:id]. Наприклад: [CART:15]
           - Якщо ти рекомендуєш ЛОКАЦІЮ (ресторан, замок), ти ЗОБОВ'ЯЗАНИЙ додати в кінці повідомлення тег у форматі [MAP:id]. Наприклад: [MAP:8]
           - Можна використовувати кілька тегів підряд, якщо рекомендуєш кілька об'єктів.`;

        const prompt = `${systemInstruction}\n\nКористувач запитує: "${message}"\nВідповідь Гіда:`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            res.json({ reply: data.candidates[0].content.parts[0].text.trim() });
        } else {
            res.status(500).json({ error: "Помилка відповіді нейромережі" });
        }
    } catch (error) {
        res.status(500).json({ error: "Не вдалося отримати відповідь від Гіда" });
    }
});

app.post('/api/analyze-reviews', async (req, res) => {
    const { reviews } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; 

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
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            res.json({ rating: data.candidates[0].content.parts[0].text.trim() });
        } else {
            res.status(500).json({ error: "Помилка API" });
        }
    } catch (error) {
        res.status(500).json({ error: "Не вдалося розрахувати рейтинг" });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер успішно запущено на http://localhost:${PORT}`);
});