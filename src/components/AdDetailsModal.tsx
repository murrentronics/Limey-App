import { X, Phone, Mail, Globe, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AdDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ad: {
    title: string;
    description?: string;
    business_name?: string;
    contact_number?: string;
    website_url?: string;
    support_email?: string;
    price_info?: string;
  };
}

const AdDetailsModal = ({ isOpen, onClose, ad }: AdDetailsModalProps) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleContactClick = (type: 'phone' | 'email' | 'website', value: string) => {
    switch (type) {
      case 'phone':
        window.open(`tel:${value}`, '_self');
        break;
      case 'email':
        window.open(`mailto:${value}`, '_self');
        break;
      case 'website':
        window.open(value.startsWith('http') ? value : `https://${value}`, '_blank');
        break;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-background border-border">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Business Details</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-2 hover:bg-muted"
          >
            <X size={20} className="text-white" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Business Name & Title */}
          <div className="text-center space-y-2">
            {ad.business_name && (
              <h3 className="text-xl font-bold text-primary">
                {ad.business_name}
              </h3>
            )}
            <h4 className="text-lg font-semibold text-white">
              {ad.title}
            </h4>
            {ad.description && (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {ad.description}
              </p>
            )}
          </div>

          {/* Price Information */}
          {ad.price_info && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className="text-green-400" />
                <span className="font-medium text-white">Pricing</span>
              </div>
              <p className="text-green-400 font-semibold">
                {ad.price_info}
              </p>
            </div>
          )}

          {/* Contact Information */}
          <div className="space-y-3">
            <h5 className="font-medium text-white mb-3">Contact Information</h5>
            
            {ad.contact_number && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto p-4"
                onClick={() => handleContactClick('phone', ad.contact_number!)}
              >
                <Phone size={18} className="text-blue-400" />
                <div className="text-left">
                  <div className="font-medium text-white">Call Us</div>
                  <div className="text-sm text-muted-foreground">{ad.contact_number}</div>
                </div>
              </Button>
            )}

            {ad.support_email && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto p-4"
                onClick={() => handleContactClick('email', ad.support_email!)}
              >
                <Mail size={18} className="text-green-400" />
                <div className="text-left">
                  <div className="font-medium text-white">Email Us</div>
                  <div className="text-sm text-muted-foreground">{ad.support_email}</div>
                </div>
              </Button>
            )}

            {ad.website_url && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto p-4"
                onClick={() => handleContactClick('website', ad.website_url!)}
              >
                <Globe size={18} className="text-purple-400" />
                <div className="text-left">
                  <div className="font-medium text-white">Visit Website</div>
                  <div className="text-sm text-muted-foreground">{ad.website_url}</div>
                </div>
              </Button>
            )}
          </div>

          {/* Sponsored Badge */}
          <div className="text-center pt-4 border-t border-border">
            <Badge variant="outline" className="bg-yellow-900/50 text-yellow-400 border-yellow-600">
              📢 Sponsored Content
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              This is a paid advertisement
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdDetailsModal;