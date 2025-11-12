import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mysten/dapp-kit/dist/index.css';

const ClientProviders = dynamic(() => import('@/components/common/ClientProviders'), {
  ssr: false,
});

// Create query client
const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>IoTrade - Monetize your IoT Data</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <QueryClientProvider client={queryClient}>
        <ClientProviders>
          <Component {...pageProps} />
        </ClientProviders>
      </QueryClientProvider>
    </>
  );
}
