"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  deleteGalleryImage,
  reorderGalleryImages,
  updateGalleryImageAlt,
  uploadGalleryImages,
} from "@/modules/gallery/services/gallery-actions";

export interface GalleryImageItem {
  id: string;
  url: string;
  alt_text: string | null;
}

export function GalleryManager({ images }: { images: GalleryImageItem[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAlt, setEditingAlt] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    for (const file of Array.from(files)) formData.append("files", file);
    const result = await uploadGalleryImages(formData);

    setUploading(false);
    event.target.value = "";

    if (result.error) {
      setError(result.error);
      return;
    }

    toast.success("Fotos adicionadas com sucesso.");
    router.refresh();
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length || reordering) return;

    const reordered = [...images];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    setReordering(true);
    const result = await reorderGalleryImages(reordered.map((image) => image.id));
    setReordering(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleSaveAlt(id: string) {
    setBusyId(id);
    const result = await updateGalleryImageAlt(id, editingAlt);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setEditingId(null);
    toast.success("Texto alternativo atualizado.");
    router.refresh();
  }

  async function handleDelete(image: GalleryImageItem) {
    const confirmed = await confirm({
      title: "Excluir esta foto?",
      description: "Essa ação é permanente e não pode ser desfeita.",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!confirmed) return;

    setBusyId(image.id);
    const result = await deleteGalleryImage(image.id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Foto excluída com sucesso.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-xs">
        <Button
          type="button"
          size="sm"
          isLoading={uploading}
          className="h-9 text-xs font-bold px-4"
          onClick={() => fileInputRef.current?.click()}
        >
          + Adicionar Fotos
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
        <span className="text-[11px] text-text-muted">PNG, JPG ou WEBP até 5MB por imagem</span>
      </div>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      {images.length === 0 ? (
        <p className="text-xs text-text-secondary py-6 text-center rounded-xl border border-dashed border-border/80">
          Nenhuma foto cadastrada. O carrossel do site público exibe o placeholder &quot;Foto em breve&quot; até que você adicione imagens aqui.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image, index) => (
            <div key={image.id} className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card p-3 shadow-xs">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border/60 bg-card-elevated">
                <Image
                  src={image.url}
                  alt={image.alt_text ?? ""}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>

              {editingId === image.id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={editingAlt}
                    onChange={(e) => setEditingAlt(e.target.value)}
                    placeholder="Texto alternativo (opcional)"
                    className="h-8 flex-1 min-w-0 rounded-md border border-border bg-card-elevated px-2.5 text-xs text-text-primary focus:border-primary focus:outline-none"
                  />
                  <Button
                    size="sm"
                    isLoading={busyId === image.id}
                    onClick={() => handleSaveAlt(image.id)}
                    className="h-8 text-[11px] px-2.5"
                  >
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 text-[11px] px-2.5">
                    Cancelar
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(image.id);
                    setEditingAlt(image.alt_text ?? "");
                  }}
                  className="text-left text-[11px] text-text-secondary hover:text-text-primary truncate"
                >
                  {image.alt_text || "+ Adicionar texto alternativo"}
                </button>
              )}

              <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/50">
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={index === 0 || reordering}
                    onClick={() => handleMove(index, -1)}
                    aria-label="Mover para cima"
                  >
                    ▲
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={index === images.length - 1 || reordering}
                    onClick={() => handleMove(index, 1)}
                    aria-label="Mover para baixo"
                  >
                    ▼
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  className="h-7 text-[11px] px-2.5"
                  isLoading={busyId === image.id}
                  onClick={() => handleDelete(image)}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
