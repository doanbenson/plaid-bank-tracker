# Flask Backend Setup Instructions

## Python Installation Required

Python is not currently installed on your system. Please install Python 3.10+ before proceeding with the Flask backend setup.

### Installation Options:
1. **Microsoft Store** (Recommended for Windows):
   - Open Microsoft Store
   - Search for "Python 3.12" or "Python 3.11"
   - Click "Get" to install

2. **Official Python.org**:
   - Download from https://www.python.org/downloads/
   - Run installer and check "Add Python to PATH"

### After Installing Python:

1. Create virtual environment:
   ```bash
   cd apps/api
   python -m venv venv
   ```

2. Activate virtual environment:
   ```bash
   # Windows PowerShell
   .\venv\Scripts\Activate.ps1
   
   # Windows CMD
   .\venv\Scripts\activate.bat
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run Flask server:
   ```bash
   python run.py
   ```

The Flask API will be available at http://localhost:5000
