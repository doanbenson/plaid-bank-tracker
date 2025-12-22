from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Enable CORS for Next.js frontend
    CORS(app, origins=['http://localhost:3000'])
    
    # Register blueprints
    from app.routes import plaid, accounts, transactions
    app.register_blueprint(plaid.bp)
    app.register_blueprint(accounts.bp)
    app.register_blueprint(transactions.bp)
    
    @app.route('/health')
    def health():
        return {'status': 'healthy'}, 200
    
    return app
