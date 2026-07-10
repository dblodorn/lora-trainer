import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en" data-rs-theme="lora-trainer" data-rs-color-mode="light">
      <Head>
        <title>arena trainer</title>
        <link rel="icon" href="/dmbk.png" />
        <meta property="og:title" content="arena trainer" />
        <meta property="og:image" content="/trainer.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="/trainer.jpg" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
