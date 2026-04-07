import os
from dotenv import load_dotenv
from plaid.api import plaid_api
from plaid.model.country_code import CountryCode
from plaid.model.products import Products
import plaid

load_dotenv()

# Plaid Configuration
PLAID_CLIENT_ID = os.getenv('PLAID_CLIENT_ID')
PLAID_SECRET = os.getenv('PLAID_SECRET')
PLAID_ENV = os.getenv('PLAID_ENV', 'sandbox')

# Set Plaid environment
if PLAID_ENV == 'sandbox':
    host = plaid.Environment.Sandbox
elif PLAID_ENV == 'development':
    host = plaid.Environment.Development
elif PLAID_ENV == 'production':
    host = plaid.Environment.Production
else:
    host = plaid.Environment.Sandbox

# Plaid Configuration
configuration = plaid.Configuration(
    host=host,
    api_key={
        'clientId': PLAID_CLIENT_ID,
        'secret': PLAID_SECRET,
    }
)

# Plaid API Client
api_client = plaid.ApiClient(configuration)
plaid_client = plaid_api.PlaidApi(api_client)

# Plaid Products - auth includes balance, transactions syncs transactions
PLAID_PRODUCTS = [Products('auth'), Products('transactions')]
PLAID_COUNTRY_CODES = [CountryCode('US')]
