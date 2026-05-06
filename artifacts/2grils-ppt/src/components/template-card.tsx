import { Link } from "wouter";
import { Star, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Template } from "@workspace/api-client-react";

interface TemplateCardProps {
  template: Template;
  onAddToCart?: (id: number) => void;
}

export function TemplateCard({ template, onAddToCart }: TemplateCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50">
      <Link href={`/templates/${template.id}`}>
        <div className="relative aspect-[16/9] overflow-hidden bg-muted cursor-pointer">
          <img 
            src={template.thumbnailUrl} 
            alt={template.titleVi}
            className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
          />
          {template.isBestSeller && (
            <Badge className="absolute top-2 left-2 bg-yellow-500 hover:bg-yellow-600 border-none text-white font-semibold">
              Best Seller
            </Badge>
          )}
          {template.isFree && (
            <Badge className="absolute top-2 right-2 brand-gradient border-none text-white font-semibold">
              Free
            </Badge>
          )}
        </div>
      </Link>
      
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{template.categoryName}</p>
          <div className="flex items-center text-yellow-500 text-xs font-medium">
            <Star className="w-3 h-3 fill-current mr-1" />
            <span>{template.avgRating.toFixed(1)}</span>
            <span className="text-muted-foreground ml-1">({template.reviewCount})</span>
          </div>
        </div>
        <Link href={`/templates/${template.id}`}>
          <h3 className="font-semibold text-base line-clamp-1 hover:text-primary transition-colors cursor-pointer" title={template.titleVi}>
            {template.titleVi}
          </h3>
        </Link>
        <div className="flex items-center text-xs text-muted-foreground mt-2 space-x-3">
          <span>{template.slideCount} slides</span>
          <span>&bull;</span>
          <span>{template.aspectRatio}</span>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex justify-between items-center">
        <p className="font-bold text-lg text-primary">
          {template.isFree ? "Miễn phí" : formatPrice(template.price)}
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          className="rounded-full hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
          onClick={() => onAddToCart?.(template.id)}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Thêm
        </Button>
      </CardFooter>
    </Card>
  );
}
