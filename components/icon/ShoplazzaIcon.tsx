import React from 'react';

interface ShoplazzaIconProps {
    className?: string;
}

const ShoplazzaIcon: React.FC<ShoplazzaIconProps> = ({ className = "" }) => {
    return (
        <img
            src="/images/platforms/shoplazza_new.png"
            alt="Shoplazza"
            className={`rounded-sm ${className}`}
        />
    );
};

export default ShoplazzaIcon;
