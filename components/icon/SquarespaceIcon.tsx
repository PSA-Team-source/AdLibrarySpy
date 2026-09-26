import React from 'react';

interface SquarespaceIconProps {
    className?: string;
    width?: string;
    height?: string;
}

const SquarespaceIcon: React.FC<SquarespaceIconProps> = ({ className = "", width = "24", height = "24" }) => {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            <path d="M11.918 6.918a1.5 1.5 0 0 0-2.121 0l-3.879 3.879a1.5 1.5 0 0 0 2.121 2.121l3.879-3.879a1.5 1.5 0 0 0 0-2.121z"/>
            <path d="M15.797 7.086l-6.71 6.71a1.5 1.5 0 0 0 2.12 2.122l6.711-6.711a4.5 4.5 0 0 0-6.364-6.364l-6.71 6.711a1.5 1.5 0 0 0 2.12 2.121l6.711-6.71a1.5 1.5 0 0 1 2.122 0z"/>
            <path d="M17.918 11.086a1.5 1.5 0 0 0-2.121 0l-6.71 6.71a1.5 1.5 0 0 0 2.12 2.122l6.711-6.711a1.5 1.5 0 0 0 0-2.121z"/>
            <path d="M19.086 8.254a4.5 4.5 0 0 0-6.364 0l-6.71 6.71a1.5 1.5 0 0 0 2.12 2.122l6.711-6.711a1.5 1.5 0 0 1 2.122 2.121l-6.711 6.711a1.5 1.5 0 0 0 2.121 2.121l6.711-6.71a4.5 4.5 0 0 0 0-6.364z"/>
        </svg>
    );
};

export default SquarespaceIcon;