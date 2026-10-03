import React from 'react';

// Square (Block Inc.) mark: rounded outer square, hollow ring, small inner square.
const SquareIcon: React.FC<{ className?: string; width?: string; height?: string }> = ({ className = "", width = "24", height = "24" }) => (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className} xmlns="http://www.w3.org/2000/svg">
        <path d="M4.5 1h15A3.5 3.5 0 0 1 23 4.5v15a3.5 3.5 0 0 1-3.5 3.5h-15A3.5 3.5 0 0 1 1 19.5v-15A3.5 3.5 0 0 1 4.5 1zm1.4 4.2a.7.7 0 0 0-.7.7v12.2a.7.7 0 0 0 .7.7h12.2a.7.7 0 0 0 .7-.7V5.9a.7.7 0 0 0-.7-.7H5.9z" />
        <rect x="9.2" y="9.2" width="5.6" height="5.6" rx=".5" />
    </svg>
);

export default SquareIcon;
