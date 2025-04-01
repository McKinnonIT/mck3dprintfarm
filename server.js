const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'temp/' });
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

// Endpoint to execute commands
app.post('/api/execute', async (req, res) => {
    const { command } = req.body;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing command: ${error}`);
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ output: stdout, error: stderr });
    });
});

// Endpoint to upload files
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }

    const { originalname } = req.body;
    const newPath = path.join(tempDir, originalname);
    
    try {
        await fs.rename(req.file.path, newPath);
        res.json({ path: newPath });
    } catch (error) {
        console.error(`Error moving file: ${error}`);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to read G-code file
app.get('/api/gcode/:filename', async (req, res) => {
    const filePath = path.join(tempDir, req.params.filename);
    
    try {
        const content = await fs.readFile(filePath, 'utf8');
        res.json({ content });
    } catch (error) {
        console.error(`Error reading file: ${error}`);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 