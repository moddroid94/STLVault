# MakerWorld Token Setup

To enable the MakerWorld Import functionality, you need to configure an API token from your MakerWorld account. This token is used by STLVault's backend to authenticate requests when fetching model data and files from the MakerWorld platform.

## Steps to Configure the Token

1.  **Obtain a Token:**
    *   Log in to your [MakerWorld](https://www.makerworld.com/) account.
    *   Navigate to your **Account Settings** or **API Access** section (the exact location may vary based on MakerWorld's current interface).
    *   Generate a new API token. **Keep this token secure, as it grants access to your account data.**

2.  **Set Token in Web UI Settings:**
    The application allows you to set the MakerWorld API token directly through the Web UI. 

    *   Open the Web UI in your browser.
    *   Navigate to the **Settings** page.
    *   Locate the field for the MakerWorld/Bambu Cloud token and paste your generated token there.
    *   Save the settings.

3.  **Verify Configuration:**
    After saving the token in the settings, test the MakerWorld Import feature in the frontend to ensure it connects successfully.