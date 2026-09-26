import React from 'react';

interface ShoplineIconProps {
    className?: string;
}

const ShoplineIcon: React.FC<ShoplineIconProps> = ({ className = "" }) => {
    return (
        <img
            src="/images/platforms/shopline.png"
            alt="Shopline"
            className={`rounded-sm ${className}`}
        />
    );
};

export default ShoplineIcon;
