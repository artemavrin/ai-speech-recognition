import React from 'react';

interface IconProps {
  className?: string;
}

export const ChatBubbleLeftRightIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3.686-3.686a1.096 1.096 0 00-.778-.322H6.75c-1.105 0-2-.895-2-2V9.608c0-.99.616-1.811 1.5-2.097M16.5 9.75V14.25M12 12H4.5m3.75-3.75H12m-1.125 0L12 6m-1.125 0L9.75 9.75M12 6H9.75m-3.75 0H4.5m12 6V9.75M12 12V9.75m0 0L13.125 6M12 6l1.125 3.75M12 6h2.25m3.75 0h2.25M12 12h3.75m0 0L16.5 18m-1.125-3.75L14.25 18m1.125-3.75L16.5 12m-1.125 3.75L14.25 12m0 6h-2.25m-3.75 0H9.75M12 18h-2.25m3.75-3.75h-3.75m3.75-3.75h-3.75M12 9.75V6M12 6V9.75m0 3.75v3.75m0-3.75V9.75" />
  </svg>
);
