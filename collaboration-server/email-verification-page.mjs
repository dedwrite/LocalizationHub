export const EMAIL_VERIFICATION_PAGE =
`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >
  <title>Verify email - LocalizationHub</title>

  <link
    rel="icon"
    href="/favicon.ico"
    type="image/x-icon"
  >

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family:
        Inter,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
      background: #0b0d10;
      color: #f5f7fa;
    }

    main {
      width: min(460px, 100%);
      padding: 32px;
      border: 1px solid #272b31;
      border-radius: 16px;
      background: #111419;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 26px;
    }

    p {
      margin: 0 0 24px;
      line-height: 1.6;
      color: #aeb6c2;
    }

    button {
      width: 100%;
      min-height: 46px;
      border: 0;
      border-radius: 10px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      background: #f5f7fa;
      color: #111419;
    }

    button:disabled {
      cursor: wait;
      opacity: 0.65;
    }

    #status {
      margin-top: 18px;
      margin-bottom: 0;
    }
  </style>
</head>

<body>
  <main>
    <h1>Verify your email</h1>

    <p>
      Confirm the email address connected to your
      LocalizationHub account.
    </p>

    <button
      id="verify"
      type="button"
    >
      Verify email
    </button>

    <p
      id="status"
      role="status"
      aria-live="polite"
    ></p>
  </main>

  <script>
    const button =
      document.getElementById(
        'verify'
      )

    const status =
      document.getElementById(
        'status'
      )

    const token =
      new URLSearchParams(
        window.location.search
      ).get(
        'token'
      )

    if (!token) {
      button.disabled =
        true

      status.textContent =
        'This verification link is invalid.'
    }

    button.addEventListener(
      'click',
      async () => {
        if (!token) {
          return
        }

        button.disabled =
          true

        status.textContent =
          'Verifying...'

        try {
          const response =
            await fetch(
              '/api/auth/verification/verify',
              {
                method:
                  'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body:
                  JSON.stringify({
                    token,
                  }),
              },
            )

          const body =
            await response
              .json()
              .catch(
                () => null
              )

          if (!response.ok) {
            throw new Error(
              body?.message ||
                'Email verification failed.'
            )
          }

          history.replaceState(
            null,
            '',
            '/verify-email',
          )

          button.hidden =
            true

          status.textContent =
            'Email verified. You can return to LocalizationHub.'
        } catch (
          error
        ) {
          status.textContent =
            error instanceof Error
              ? error.message
              : 'Email verification failed.'

          button.disabled =
            false
        }
      },
    )
  </script>
</body>
</html>`
