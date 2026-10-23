import { useEffect, useMemo } from "react";
import { createThirdwebClient } from "thirdweb";
import { ethereum } from "thirdweb/chains";
import { BridgeWidget, ThirdwebProvider, useConnect } from "thirdweb/react";
import { privateKeyToAccount, createWalletAdapter } from "thirdweb/wallets";

// This component is only ever loaded in the browser (dynamic import from
// SwapWidget), so the native WebSocket is always available here.


interface InnerProps {
  clientId: string;
  privateKey: string;
  address: string;
  onSuccess?: (data: unknown) => void;
  onError?: (message: string) => void;
}

export function SwapWidgetInner(props: InnerProps) {
  return (
    <ThirdwebProvider>
      <Bridge {...props} />
    </ThirdwebProvider>
  );
}

function Bridge({ clientId, privateKey, onSuccess, onError }: InnerProps) {
  const client = useMemo(() => createThirdwebClient({ clientId }), [clientId]);

  const { connect } = useConnect();

  useEffect(() => {
    let cancelled = false;
    void connect(async () => {
      const account = privateKeyToAccount({ client, privateKey });
      const wallet = createWalletAdapter({
        client,
        adaptedAccount: account,
        chain: ethereum,
        onDisconnect: () => {},
        switchChain: async () => {},
      });
      if (cancelled) throw new Error("cancelled");
      return wallet;
    }).catch((e) => onError?.(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [client, privateKey, connect, onError]);

  return (
    <div className="w-full max-w-full overflow-x-auto">
      <div className="mx-auto w-fit">
        <BridgeWidget
          client={client}
          theme="dark"
          swap={{
            onSuccess: (data) => onSuccess?.({ kind: "swap", quote: data.quote?.originAmount?.toString?.() }),
            onError: (e) => onError?.(e.message),
          }}
        />
      </div>
    </div>
  );
}
