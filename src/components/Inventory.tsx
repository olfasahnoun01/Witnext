import { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Filter,
  Image as ImageIcon,
  X,
  Upload
} from 'lucide-react';
import { getAllProducts, createProduct, updateProduct, deleteProduct } from '@/services/dbService';
import { Product, StockStatus } from '@/types';
import { Button } from '@/components/ui/button';

const CATEGORIES = ['Pantalons', 'Blousons', 'Bordequin', 'Accessoires', 'Gants', 'Casques', 'Gilets'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', 'Unique'];

const getStockStatus = (product: Product): StockStatus => {
  if (product.quantity === 0) return 'out_of_stock';
  if (product.quantity <= product.min_stock) return 'low_stock';
  return 'in_stock';
};

const statusLabels: Record<StockStatus, { label: string; class: string }> = {
  in_stock: { label: 'En Stock', class: 'status-badge-success' },
  low_stock: { label: 'Stock Faible', class: 'status-badge-warning' },
  out_of_stock: { label: 'Rupture', class: 'status-badge-danger' }
};

const COLORS = ['Noir', 'Blanc', 'Bleu', 'Rouge', 'Vert', 'Jaune', 'Orange', 'Gris', 'Marron', 'Beige'];

interface ProductFormData {
  name: string;
  sku: string;
  category: string;
  fournisseur: string;
  size: string;
  quantity: number;
  price: number;
  min_stock: number;
  image: string | null;
  color: string;
}

const emptyFormData: ProductFormData = {
  name: '',
  sku: '',
  category: '',
  fournisseur: '',
  size: '',
  quantity: 0,
  price: 0,
  min_stock: 5,
  image: null,
  color: ''
};

export const Inventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProducts();
    const interval = setInterval(loadProducts, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadProducts = async () => {
    const data = await getAllProducts();
    setProducts(data);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.fournisseur.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        category: product.category,
        fournisseur: product.fournisseur,
        size: product.size,
        quantity: product.quantity,
        price: product.price,
        min_stock: product.min_stock,
        image: product.image || null,
        color: product.color || ''
      });
    } else {
      setEditingProduct(null);
      setFormData(emptyFormData);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData(emptyFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
        await loadProducts();
        handleCloseModal();
      } else {
        const result = await createProduct(formData);
        if (result.success) {
          await loadProducts();
          handleCloseModal();
        } else {
          alert(result.error || 'Erreur lors de la création du produit');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${product.name}" ?`)) {
      await deleteProduct(product.id);
      await loadProducts();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const uniqueCategories = [...new Set(products.map(p => p.category))];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="flex-1 flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par nom, code article ou fournisseur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground flex-1"
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-foreground"
            >
              <option value="">Toutes catégories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter Produit
        </Button>
      </div>

      {/* Table */}
      <div className="table-container overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Désignation</th>
              <th>Code Article</th>
              <th>Catégorie</th>
              <th>Taille</th>
              <th>Couleur</th>
              <th>Fournisseur</th>
              <th>Quantité</th>
              <th>Prix (TND)</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-12 text-muted-foreground">
                  Aucun produit trouvé
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => {
                const status = getStockStatus(product);
                const statusInfo = statusLabels[status];
                
                return (
                  <tr key={product.id}>
                    <td>
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </td>
                    <td className="font-medium text-foreground">{product.name}</td>
                    <td className="text-muted-foreground font-mono text-xs">{product.sku}</td>
                    <td>{product.category}</td>
                    <td>{product.size}</td>
                    <td>
                      {product.color && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{product.color}</span>
                        </div>
                      )}
                    </td>
                    <td className="text-muted-foreground">{product.fournisseur}</td>
                    <td className="font-medium">{product.quantity}</td>
                    <td className="font-medium">{product.price.toFixed(3)}</td>
                    <td>
                      <span className={`status-badge ${statusInfo.class}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenModal(product)}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, product)}
                          className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">
                {editingProduct ? 'Modifier Produit' : 'Ajouter Produit'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Image Upload */}
              <div className="flex items-center gap-4">
                <div 
                  className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {formData.image ? (
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Image du produit</p>
                  <p className="text-xs text-muted-foreground">Cliquez pour télécharger</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Nom du produit *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="form-input"
                    placeholder="Ex: Pantalon de Travail Pro"
                  />
                </div>

                <div>
                  <label className="form-label">Code Article *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    className="form-input"
                    placeholder="Ex: PAN-001"
                  />
                </div>

                <div>
                  <label className="form-label">Catégorie *</label>
                  <input
                    type="text"
                    required
                    list="categories"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="form-input"
                    placeholder="Sélectionner ou saisir"
                  />
                  <datalist id="categories">
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="form-label">Taille</label>
                  <input
                    type="text"
                    list="sizes"
                    value={formData.size}
                    onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                    className="form-input"
                    placeholder="Sélectionner ou saisir (optionnel)"
                  />
                  <datalist id="sizes">
                    {SIZES.map(size => (
                      <option key={size} value={size} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="form-label">Fournisseur</label>
                  <input
                    type="text"
                    value={formData.fournisseur}
                    onChange={(e) => setFormData(prev => ({ ...prev, fournisseur: e.target.value }))}
                    className="form-input"
                    placeholder="Nom du fournisseur (optionnel)"
                  />
                </div>

                <div>
                  <label className="form-label">Prix (TND)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    className="form-input"
                    placeholder="0.000 (optionnel)"
                  />
                </div>

                <div>
                  <label className="form-label">Couleur</label>
                  <input
                    type="text"
                    list="colors"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="form-input"
                    placeholder="Sélectionner ou saisir (optionnel)"
                  />
                  <datalist id="colors">
                    {COLORS.map(color => (
                      <option key={color} value={color} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="form-label">Quantité *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Stock Minimum *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.min_stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_stock: parseInt(e.target.value) || 0 }))}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : editingProduct ? 'Enregistrer' : 'Ajouter'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
