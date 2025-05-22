
import React from 'react';

interface IconProps {
  className?: string;
}

export const UserGroupIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-3.471-1.612c-1.241.979-2.643 1.612-4.129 1.612S8.714 18.077 7.472 17.098a5.971 5.971 0 00-3.471 1.612M12 13.485A3.75 3.75 0 1012 6a3.75 3.75 0 000 7.485zm-4.33 4.14A5.94 5.94 0 005.25 14.259a9.023 9.023 0 002.014 3.689c.23.18.49.328.767.448A5.985 5.985 0 0112 17.25a5.985 5.985 0 013.969 1.136c.277-.12.537-.268.767-.448a9.023 9.023 0 002.014-3.689 5.94 5.94 0 00-2.42-3.365" />
  </svg>
);
