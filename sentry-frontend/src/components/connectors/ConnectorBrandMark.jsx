import React, { useEffect, useState } from 'react';
import { Database } from 'lucide-react';

const ConnectorBrandMark = ({ iconPath, label, className = '', imageClassName = '', fallbackClassName = '', fallbackIconSize = 16 }) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
    }, [iconPath]);

    if (iconPath && !hasError) {
        return (
            <img
                src={iconPath}
                alt={label}
                className={imageClassName || className}
                onError={() => setHasError(true)}
            />
        );
    }

    return (
        <div className={fallbackClassName || className} aria-label={label}>
            <Database size={fallbackIconSize} color="#FFF" />
        </div>
    );
};

export default ConnectorBrandMark;
