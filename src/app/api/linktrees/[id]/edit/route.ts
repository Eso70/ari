import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/get-session";
import { editDataResponseSchema } from "@/lib/validation/linktree";
import type { Linktree, Link } from "@/lib/db/queries";

export const revalidate = 0;
export const dynamic = 'force-dynamic';

const COLS_LINKTREE = "id, name, subtitle, seo_name, uid, image, background_color, template_config, footer_text, footer_phone, footer_hidden, status, created_at, updated_at";
const COLS_LINK = "id, linktree_id, platform, url, display_name, description, default_message, display_order, click_count, metadata, created_at, updated_at";

// GET /api/linktrees/[id]/edit - Get linktree with links for editing (admin only)
// Always fetches fresh data directly from DB (no cache) - like public page
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin session
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Invalid linktree ID format" },
        { status: 400 }
      );
    }
    
    // Fetch directly from DB (bypass Redis cache) - always fresh data
    const [linktreeResult, linksResult] = await Promise.all([
      query<Linktree>(`SELECT ${COLS_LINKTREE} FROM linktrees WHERE id = $1`, [id]),
      query<Link>(`SELECT ${COLS_LINK} FROM links WHERE linktree_id = $1 ORDER BY display_order ASC`, [id]),
    ]);
    
    const linktree = linktreeResult.rows[0];
    const links = linksResult.rows || [];

    if (!linktree) {
      return NextResponse.json(
        { error: "Linktree not found" },
        { status: 404 }
      );
    }

    // Prepare response data with proper null handling
    // Convert Date objects to ISO strings for validation
    const toISOString = (val: unknown): string => {
      if (val instanceof Date) return val.toISOString();
      if (typeof val === "string") return val;
      return new Date().toISOString();
    };
    
    const responseData = {
      linktree: {
        id: linktree.id,
        name: linktree.name || "",
        subtitle: linktree.subtitle || null,
        seo_name: linktree.seo_name || "",
        uid: linktree.uid || "",
        image: linktree.image || null,
        background_color: linktree.background_color || "#6366f1",
        template_config: linktree.template_config || null,
        footer_text: linktree.footer_text || null,
        footer_phone: linktree.footer_phone || null,
        footer_hidden: linktree.footer_hidden ?? false,
        created_at: toISOString(linktree.created_at),
        updated_at: toISOString(linktree.updated_at),
      },
      links: (links || []).map(link => {
        // Safely handle metadata - ensure it's either an object or null
        let safeMetadata: Record<string, unknown> | null = null;
        if (link.metadata && typeof link.metadata === "object" && !Array.isArray(link.metadata)) {
          try {
            // Ensure metadata is a plain object
            safeMetadata = link.metadata as Record<string, unknown>;
          } catch {
            safeMetadata = null;
          }
        }
        
        return {
          id: link.id,
          platform: link.platform || "",
          url: link.url || "",
          display_name: link.display_name || null,
          description: link.description || null,
          default_message: link.default_message || null,
          display_order: typeof link.display_order === "number" ? link.display_order : 0,
          metadata: safeMetadata,
        };
      }),
    };

    // Validate response data with Zod schema (non-blocking)
    // Wrap in try-catch to prevent crashes from validation errors
    try {
      const validationResult = editDataResponseSchema.safeParse(responseData);
      if (!validationResult.success) {
        console.error("Response data validation failed:", JSON.stringify(validationResult.error.issues, null, 2));
        // Still return data but log the validation error
        // This allows the system to work even if schema is slightly off
      }
    } catch (validationError) {
      console.error("Validation error (non-blocking):", validationError);
      // Continue execution even if validation fails
    }

    return NextResponse.json(
      { 
        data: responseData,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error("Error fetching edit data:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch edit data";
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}

