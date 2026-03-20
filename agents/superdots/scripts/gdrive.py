#!/usr/bin/env python3
"""Google Drive utility for Superdots agents.

Usage:
    python3 scripts/gdrive.py list [folder_id]          # List files in folder (default: root)
    python3 scripts/gdrive.py create-doc <name> <folder_id> <content>  # Create a Google Doc
    python3 scripts/gdrive.py create-rich-doc <name> <folder_id> <json>  # Create styled Google Doc (JSON spec)
    python3 scripts/gdrive.py create-presentation <name> <folder_id> <json>  # Create Google Slides (JSON spec)
    python3 scripts/gdrive.py upload <name> <folder_id> <filepath>     # Upload a file
    python3 scripts/gdrive.py mkdir <name> [parent_id]   # Create a folder
    python3 scripts/gdrive.py search <query>             # Search files
    python3 scripts/gdrive.py read <file_id>             # Read file content/metadata
    python3 scripts/gdrive.py share <file_id> <email> [role]  # Share file (role: reader/writer)

create-rich-doc JSON format:
    { "blocks": [
        { "type": "heading", "level": 1, "text": "Title", "font": "Arial", "size": 24, "color": "#000000", "bold": true },
        { "type": "paragraph", "text": "Body text", "font": "Arial", "size": 11, "color": "#333333", "bold": false, "italic": false, "underline": false },
        { "type": "page_break" }
    ]}

create-presentation JSON format:
    { "slides": [
        { "layout": "TITLE", "title": "Presentation Title", "subtitle": "Subtitle",
          "background": "#FFFFFF" },
        { "layout": "TITLE_AND_BODY", "title": "Slide Title", "body": "Slide content",
          "background": "#FFFFFF", "titleStyle": { "font": "Arial", "size": 28, "color": "#000000", "bold": true },
          "bodyStyle": { "font": "Arial", "size": 16, "color": "#333333" } },
        { "layout": "BLANK", "background": "#1a1a2e",
          "shapes": [{ "type": "RECTANGLE", "x": 100, "y": 100, "width": 200, "height": 100, "fillColor": "#0066cc" }],
          "images": [{ "url": "https://example.com/image.png", "x": 300, "y": 100, "width": 200, "height": 150 }] }
    ]}

Environment:
    GDRIVE_KEY_FILE  - Path to service account JSON key (default: .secrets/gdrive-service-account.json)
    GDRIVE_ROOT_ID   - Root folder ID (default: 16hrle1lTNjRr-IDDXDbV74XYYkhpTJJW)
    GDRIVE_IMPERSONATE - Email to impersonate via domain-wide delegation (default: lucavittorio.bartoccini@superdots.sh)
"""

import json, sys, os, time, base64, urllib.request, urllib.parse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DEFAULT_KEY_FILE = os.path.join(PROJECT_ROOT, ".secrets", "gdrive-service-account.json")
DEFAULT_ROOT_ID = "16hrle1lTNjRr-IDDXDbV74XYYkhpTJJW"
DEFAULT_IMPERSONATE = "lucavittorio.bartoccini@superdots.sh"

KEY_FILE = os.environ.get("GDRIVE_KEY_FILE", DEFAULT_KEY_FILE)
ROOT_ID = os.environ.get("GDRIVE_ROOT_ID", DEFAULT_ROOT_ID)
IMPERSONATE = os.environ.get("GDRIVE_IMPERSONATE", DEFAULT_IMPERSONATE)


def get_access_token():
    """Get OAuth2 access token using service account JWT with domain-wide delegation."""
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    with open(KEY_FILE) as f:
        creds = json.load(f)

    header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()).rstrip(b"=")
    now = int(time.time())
    claim_set = {
        "iss": creds["client_email"],
        "sub": IMPERSONATE,
        "scope": "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/presentations",
        "aud": creds["token_uri"],
        "iat": now,
        "exp": now + 3600,
    }
    payload = base64.urlsafe_b64encode(json.dumps(claim_set).encode()).rstrip(b"=")

    private_key = serialization.load_pem_private_key(creds["private_key"].encode(), password=None)
    message = header + b"." + payload
    signature = private_key.sign(message, padding.PKCS1v15(), hashes.SHA256())
    sig_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=")
    jwt_token = (header + b"." + payload + b"." + sig_b64).decode()

    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt_token,
    }).encode()
    req = urllib.request.Request(creds["token_uri"], data=data, method="POST")
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())["access_token"]


def api_request(method, url, token, data=None):
    """Make an authenticated API request."""
    headers = {"Authorization": f"Bearer {token}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(data).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        error = json.loads(e.read())
        print(f"Error {e.code}: {error.get('error', {}).get('message', 'unknown')}", file=sys.stderr)
        sys.exit(1)


def cmd_list(token, folder_id=None):
    folder_id = folder_id or ROOT_ID
    q = urllib.parse.quote(f"'{folder_id}' in parents and trashed = false")
    result = api_request("GET", f"https://www.googleapis.com/drive/v3/files?q={q}&fields=files(id,name,mimeType,modifiedTime)&orderBy=name", token)
    for f in result.get("files", []):
        kind = "📁" if "folder" in f["mimeType"] else "📄"
        print(f"{kind} {f['name']}  (id: {f['id']})")


def cmd_mkdir(token, name, parent_id=None):
    parent_id = parent_id or ROOT_ID
    result = api_request("POST", "https://www.googleapis.com/drive/v3/files", token, {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id],
    })
    print(json.dumps({"id": result["id"], "name": result["name"]}))


def cmd_create_doc(token, name, folder_id, content):
    # Create a Google Doc
    result = api_request("POST", "https://www.googleapis.com/drive/v3/files", token, {
        "name": name,
        "mimeType": "application/vnd.google-apps.document",
        "parents": [folder_id],
    })
    file_id = result["id"]
    # Insert content via Docs API
    api_request("POST", f"https://docs.googleapis.com/v1/documents/{file_id}:batchUpdate", token, {
        "requests": [{"insertText": {"location": {"index": 1}, "text": content}}]
    })
    print(json.dumps({"id": file_id, "name": name, "link": f"https://docs.google.com/document/d/{file_id}"}))


def _parse_hex_color(hex_color):
    """Convert '#RRGGBB' to {'red': 0-1, 'green': 0-1, 'blue': 0-1}."""
    h = hex_color.lstrip("#")
    return {
        "red": int(h[0:2], 16) / 255.0,
        "green": int(h[2:4], 16) / 255.0,
        "blue": int(h[4:6], 16) / 255.0,
    }


def cmd_create_rich_doc(token, name, folder_id, spec_json):
    """Create a Google Doc with rich formatting via Docs API batchUpdate."""
    spec = json.loads(spec_json) if isinstance(spec_json, str) else spec_json
    blocks = spec.get("blocks", [])

    # Create empty doc
    result = api_request("POST", "https://www.googleapis.com/drive/v3/files", token, {
        "name": name,
        "mimeType": "application/vnd.google-apps.document",
        "parents": [folder_id],
    })
    file_id = result["id"]

    # Build batchUpdate requests — insert text in reverse order so indices stay stable
    requests = []
    index = 1  # Docs start at index 1

    # First pass: insert all text
    text_segments = []  # (start_index, end_index, block)
    full_text = ""
    for block in blocks:
        if block["type"] == "page_break":
            full_text += "\n"
            text_segments.append((len(full_text) - 1, len(full_text), block))
        elif block["type"] in ("heading", "paragraph"):
            start = len(full_text)
            full_text += block["text"] + "\n"
            text_segments.append((start, start + len(block["text"]), block))

    if full_text:
        requests.append({"insertText": {"location": {"index": index}, "text": full_text}})

    # Second pass: apply formatting
    for start, end, block in text_segments:
        abs_start = index + start
        abs_end = index + end

        if block["type"] == "page_break":
            requests.append({
                "insertPageBreak": {"location": {"index": abs_start}}
            })
            continue

        # Text style
        style = {}
        update_fields = []
        if block.get("font"):
            style["weightedFontFamily"] = {"fontFamily": block["font"]}
            update_fields.append("weightedFontFamily")
        if block.get("size"):
            style["fontSize"] = {"magnitude": block["size"], "unit": "PT"}
            update_fields.append("fontSize")
        if block.get("color"):
            style["foregroundColor"] = {"color": {"rgbColor": _parse_hex_color(block["color"])}}
            update_fields.append("foregroundColor")
        if block.get("bold"):
            style["bold"] = True
            update_fields.append("bold")
        if block.get("italic"):
            style["italic"] = True
            update_fields.append("italic")
        if block.get("underline"):
            style["underline"] = True
            update_fields.append("underline")

        if update_fields:
            requests.append({
                "updateTextStyle": {
                    "range": {"startIndex": abs_start, "endIndex": abs_end},
                    "textStyle": style,
                    "fields": ",".join(update_fields),
                }
            })

        # Paragraph style for headings
        if block["type"] == "heading":
            level = block.get("level", 1)
            named_style = f"HEADING_{min(level, 6)}"
            requests.append({
                "updateParagraphStyle": {
                    "range": {"startIndex": abs_start, "endIndex": abs_end + 1},
                    "paragraphStyle": {"namedStyleType": named_style},
                    "fields": "namedStyleType",
                }
            })

    if requests:
        api_request("POST", f"https://docs.googleapis.com/v1/documents/{file_id}:batchUpdate", token, {
            "requests": requests,
        })

    print(json.dumps({"id": file_id, "name": name, "link": f"https://docs.google.com/document/d/{file_id}"}))


def _emu(val):
    """Convert points to EMU (English Metric Units). 1 pt = 12700 EMU."""
    return int(val * 12700)


def cmd_create_presentation(token, name, folder_id, spec_json):
    """Create a Google Slides presentation via the Slides API."""
    spec = json.loads(spec_json) if isinstance(spec_json, str) else spec_json
    slides_spec = spec.get("slides", [])

    # Create presentation
    pres = api_request("POST", "https://slides.googleapis.com/v1/presentations", token, {
        "title": name,
    })
    pres_id = pres["presentationId"]

    # Move to target folder
    api_request("PATCH",
        f"https://www.googleapis.com/drive/v3/files/{pres_id}?addParents={folder_id}&removeParents=root",
        token)

    # Get existing slide IDs (new presentation has one blank slide)
    existing_slides = pres.get("slides", [])

    requests = []

    # Delete the default blank slide if we have slides to add
    if existing_slides and slides_spec:
        requests.append({"deleteObject": {"objectId": existing_slides[0]["objectId"]}})

    for i, slide in enumerate(slides_spec):
        slide_id = f"slide_{i}"
        layout = slide.get("layout", "BLANK")

        # Create slide
        if layout == "TITLE":
            requests.append({
                "createSlide": {
                    "objectId": slide_id,
                    "slideLayoutReference": {"predefinedLayout": "TITLE"},
                    "placeholderIdMappings": [
                        {"layoutPlaceholder": {"type": "CENTERED_TITLE"}, "objectId": f"{slide_id}_title"},
                        {"layoutPlaceholder": {"type": "SUBTITLE"}, "objectId": f"{slide_id}_subtitle"},
                    ],
                }
            })
            if slide.get("title"):
                requests.append({"insertText": {"objectId": f"{slide_id}_title", "text": slide["title"]}})
            if slide.get("subtitle"):
                requests.append({"insertText": {"objectId": f"{slide_id}_subtitle", "text": slide["subtitle"]}})

        elif layout == "TITLE_AND_BODY":
            requests.append({
                "createSlide": {
                    "objectId": slide_id,
                    "slideLayoutReference": {"predefinedLayout": "TITLE_AND_BODY"},
                    "placeholderIdMappings": [
                        {"layoutPlaceholder": {"type": "TITLE"}, "objectId": f"{slide_id}_title"},
                        {"layoutPlaceholder": {"type": "BODY"}, "objectId": f"{slide_id}_body"},
                    ],
                }
            })
            if slide.get("title"):
                requests.append({"insertText": {"objectId": f"{slide_id}_title", "text": slide["title"]}})
                ts = slide.get("titleStyle", {})
                if ts:
                    style = {}
                    fields = []
                    if ts.get("font"):
                        style["weightedFontFamily"] = {"fontFamily": ts["font"]}
                        fields.append("weightedFontFamily")
                    if ts.get("size"):
                        style["fontSize"] = {"magnitude": ts["size"], "unit": "PT"}
                        fields.append("fontSize")
                    if ts.get("color"):
                        style["foregroundColor"] = {"opaqueColor": {"rgbColor": _parse_hex_color(ts["color"])}}
                        fields.append("foregroundColor")
                    if ts.get("bold"):
                        style["bold"] = True
                        fields.append("bold")
                    if fields:
                        requests.append({
                            "updateTextStyle": {
                                "objectId": f"{slide_id}_title",
                                "style": style,
                                "textRange": {"type": "ALL"},
                                "fields": ",".join(fields),
                            }
                        })
            if slide.get("body"):
                requests.append({"insertText": {"objectId": f"{slide_id}_body", "text": slide["body"]}})
                bs = slide.get("bodyStyle", {})
                if bs:
                    style = {}
                    fields = []
                    if bs.get("font"):
                        style["weightedFontFamily"] = {"fontFamily": bs["font"]}
                        fields.append("weightedFontFamily")
                    if bs.get("size"):
                        style["fontSize"] = {"magnitude": bs["size"], "unit": "PT"}
                        fields.append("fontSize")
                    if bs.get("color"):
                        style["foregroundColor"] = {"opaqueColor": {"rgbColor": _parse_hex_color(bs["color"])}}
                        fields.append("foregroundColor")
                    if fields:
                        requests.append({
                            "updateTextStyle": {
                                "objectId": f"{slide_id}_body",
                                "style": style,
                                "textRange": {"type": "ALL"},
                                "fields": ",".join(fields),
                            }
                        })

        else:  # BLANK or any other
            requests.append({
                "createSlide": {
                    "objectId": slide_id,
                    "slideLayoutReference": {"predefinedLayout": "BLANK"},
                }
            })

        # Background color
        if slide.get("background"):
            requests.append({
                "updatePageProperties": {
                    "objectId": slide_id,
                    "pageProperties": {
                        "pageBackgroundFill": {
                            "solidFill": {"color": {"rgbColor": _parse_hex_color(slide["background"])}}
                        }
                    },
                    "fields": "pageBackgroundFill.solidFill.color",
                }
            })

        # Shapes
        for j, shape in enumerate(slide.get("shapes", [])):
            shape_id = f"{slide_id}_shape_{j}"
            requests.append({
                "createShape": {
                    "objectId": shape_id,
                    "shapeType": shape.get("type", "RECTANGLE"),
                    "elementProperties": {
                        "pageObjectId": slide_id,
                        "size": {
                            "width": {"magnitude": _emu(shape.get("width", 100)), "unit": "EMU"},
                            "height": {"magnitude": _emu(shape.get("height", 100)), "unit": "EMU"},
                        },
                        "transform": {
                            "scaleX": 1, "scaleY": 1,
                            "translateX": _emu(shape.get("x", 0)),
                            "translateY": _emu(shape.get("y", 0)),
                            "unit": "EMU",
                        },
                    },
                }
            })
            if shape.get("fillColor"):
                requests.append({
                    "updateShapeProperties": {
                        "objectId": shape_id,
                        "shapeProperties": {
                            "shapeBackgroundFill": {
                                "solidFill": {"color": {"rgbColor": _parse_hex_color(shape["fillColor"])}}
                            }
                        },
                        "fields": "shapeBackgroundFill.solidFill.color",
                    }
                })

        # Images
        for j, img in enumerate(slide.get("images", [])):
            img_id = f"{slide_id}_img_{j}"
            requests.append({
                "createImage": {
                    "objectId": img_id,
                    "url": img["url"],
                    "elementProperties": {
                        "pageObjectId": slide_id,
                        "size": {
                            "width": {"magnitude": _emu(img.get("width", 200)), "unit": "EMU"},
                            "height": {"magnitude": _emu(img.get("height", 150)), "unit": "EMU"},
                        },
                        "transform": {
                            "scaleX": 1, "scaleY": 1,
                            "translateX": _emu(img.get("x", 0)),
                            "translateY": _emu(img.get("y", 0)),
                            "unit": "EMU",
                        },
                    },
                }
            })

    if requests:
        api_request("POST", f"https://slides.googleapis.com/v1/presentations/{pres_id}:batchUpdate", token, {
            "requests": requests,
        })

    print(json.dumps({
        "id": pres_id,
        "name": name,
        "link": f"https://docs.google.com/presentation/d/{pres_id}",
    }))


def cmd_upload(token, name, folder_id, filepath):
    with open(filepath, "rb") as f:
        file_data = f.read()
    # Simple upload (for files < 5MB)
    metadata = json.dumps({"name": name, "parents": [folder_id]}).encode()
    boundary = b"----Boundary"
    body = (
        b"--" + boundary + b"\r\nContent-Type: application/json\r\n\r\n" + metadata +
        b"\r\n--" + boundary + b"\r\nContent-Type: application/octet-stream\r\n\r\n" + file_data +
        b"\r\n--" + boundary + b"--"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/related; boundary={boundary.decode()}",
    }
    req = urllib.request.Request(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
        data=body, headers=headers, method="POST",
    )
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    print(json.dumps(result))


def cmd_search(token, query):
    q = urllib.parse.quote(f"fullText contains '{query}' and trashed = false")
    result = api_request("GET", f"https://www.googleapis.com/drive/v3/files?q={q}&fields=files(id,name,mimeType,webViewLink)", token)
    for f in result.get("files", []):
        kind = "📁" if "folder" in f["mimeType"] else "📄"
        print(f"{kind} {f['name']}  (id: {f['id']})")


def cmd_read(token, file_id):
    result = api_request("GET", f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=id,name,mimeType,webViewLink,modifiedTime,size", token)
    print(json.dumps(result, indent=2))


def cmd_share(token, file_id, email, role="reader"):
    result = api_request("POST", f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions?sendNotificationEmail=false", token, {
        "type": "user",
        "role": role,
        "emailAddress": email,
    })
    print(json.dumps(result))


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help", "help"):
        print(__doc__)
        sys.exit(0)

    cmd = sys.argv[1]
    token = get_access_token()

    if cmd == "list":
        cmd_list(token, sys.argv[2] if len(sys.argv) > 2 else None)
    elif cmd == "mkdir":
        cmd_mkdir(token, sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    elif cmd == "create-doc":
        cmd_create_doc(token, sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "create-rich-doc":
        cmd_create_rich_doc(token, sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "create-presentation":
        cmd_create_presentation(token, sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "upload":
        cmd_upload(token, sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "search":
        cmd_search(token, sys.argv[2])
    elif cmd == "read":
        cmd_read(token, sys.argv[2])
    elif cmd == "share":
        cmd_share(token, sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "reader")
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        print(__doc__)
        sys.exit(1)
