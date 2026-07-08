const fs = require('fs');
const path = require('path');
const FILE_PATH = path.join(__dirname, 'storage.json');

function loadData() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      const initialData = { 
        users: {}, 
        businessConnections: {}, 
        stats: { autoRepliedMessages: 0 } 
      };
      fs.writeFileSync(FILE_PATH, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    const data = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Ma'lumotlarni yuklashda xatolik:", error);
    return { users: {}, businessConnections: {}, stats: { autoRepliedMessages: 0 } };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Ma'lumotlarni saqlashda xatolik:", error);
  }
}

module.exports = { loadData, saveData };
