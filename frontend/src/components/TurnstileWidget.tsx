import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { useRef } from 'react';

interface TurnstileWidgetProps {
    siteKey: string;
    onVerify: (token: string) => void;
    onError?: () => void;
}

export default function TurnstileWidget({ siteKey, onVerify, onError }: TurnstileWidgetProps) {
    const turnstileRef = useRef<TurnstileInstance>(null);

    return (
        <div className="flex justify-center my-4">
            <Turnstile
                ref={turnstileRef}
                siteKey={siteKey}
                onSuccess={onVerify}
                onError={onError}
                options={{
                    theme: 'light',
                    size: 'normal',
                }}
            />
        </div>
    );
}
