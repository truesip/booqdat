"use client";

import { useState } from "react";
import { Plus, Edit, Trash2, Calendar, DollarSign, MapPin, Ticket, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

interface SerializedEvent {
  _id?: string;
  promoterId: string;
  title: string;
  description: string;
  date: string;
  location: string;
  latitude?: number;
  longitude?: number;
  ticketPrice: number;
  ticketQuantity: number;
  ticketsSold: number;
  whopCompanyId?: string;
  createdAt: string;
  updatedAt: string;
}

interface PromoterDashboardClientProps {
  initialEvents: SerializedEvent[];
  promoterName: string;
}

export function PromoterDashboardClient({ initialEvents, promoterName }: PromoterDashboardClientProps) {
  const [events, setEvents] = useState<SerializedEvent[]>(initialEvents);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SerializedEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Metrics calculations
  const totalEvents = events.length;
  const totalTicketsSold = events.reduce((sum, e) => sum + (e.ticketsSold || 0), 0);
  const totalRevenue = events.reduce((sum, e) => sum + ((e.ticketsSold || 0) * e.ticketPrice), 0);
  const totalCapacity = events.reduce((sum, e) => sum + (e.ticketQuantity || 0), 0);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const [ticketQuantity, setTicketQuantity] = useState("");

  function openCreateForm() {
    setEditingEvent(null);
    setTitle("");
    setDescription("");
    setDate("");
    setLocation("");
    setLatitude("");
    setLongitude("");
    setTicketPrice("");
    setTicketQuantity("");
    setError("");
    setIsFormOpen(true);
  }

  function openEditForm(event: SerializedEvent) {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description);
    // Format ISO date (e.g. 2026-06-25T14:30:00.000Z) to YYYY-MM-DDTHH:MM
    const dateFormatted = event.date ? event.date.substring(0, 16) : "";
    setDate(dateFormatted);
    setLocation(event.location);
    setLatitude(event.latitude ? String(event.latitude) : "");
    setLongitude(event.longitude ? String(event.longitude) : "");
    setTicketPrice(String(event.ticketPrice));
    setTicketQuantity(String(event.ticketQuantity));
    setError("");
    setIsFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      id: editingEvent?._id,
      title,
      description,
      date: new Date(date).toISOString(),
      location,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      ticketPrice: Number(ticketPrice),
      ticketQuantity: Number(ticketQuantity)
    };

    const method = editingEvent ? "PUT" : "POST";

    try {
      const res = await fetch("/api/promoter/events", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to save event");
      }

      // Refresh list
      const listRes = await fetch("/api/promoter/events");
      if (listRes.ok) {
        const freshEvents = await listRes.json();
        setEvents(freshEvents);
      }

      setIsFormOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred while saving the event.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/promoter/events?id=${id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to delete event");
      }

      setEvents(events.filter(e => e._id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete event.";
      alert(msg);
    }
  }

  return (
    <div className="grid gap-6">
      {/* Header section */}
      <section className="rounded-[2rem] border border-orangebrand/10 bg-white p-8 text-ink shadow-card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.35em] text-orangebrand">Promoter Hub</p>
          <h1 className="mt-3 text-4xl font-black">Welcome back, {promoterName}.</h1>
          <p className="mt-3 max-w-2xl text-ink/65">
            Create and customize live events, specify ticket pricing and capacity, and track ticket sales metrics.
          </p>
        </div>
        <Button onClick={openCreateForm} className="md:self-start flex items-center gap-2">
          <Plus className="h-5 w-5" /> Create Event
        </Button>
      </section>

      {/* Metrics section */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="rounded-[2rem] bg-white p-5 shadow-card">
          <Calendar className="h-7 w-7 text-orangebrand" />
          <p className="mt-5 text-sm font-bold text-ink/50">Total Events</p>
          <p className="mt-1 text-2xl font-black">{totalEvents}</p>
        </div>
        <div className="rounded-[2rem] bg-white p-5 shadow-card">
          <Ticket className="h-7 w-7 text-orangebrand" />
          <p className="mt-5 text-sm font-bold text-ink/50">Tickets Sold</p>
          <p className="mt-1 text-2xl font-black">{totalTicketsSold} / {totalCapacity}</p>
        </div>
        <div className="rounded-[2rem] bg-white p-5 shadow-card">
          <DollarSign className="h-7 w-7 text-orangebrand" />
          <p className="mt-5 text-sm font-bold text-ink/50">Est. Revenue</p>
          <p className="mt-1 text-2xl font-black">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="rounded-[2rem] bg-white p-5 shadow-card">
          <TrendingUp className="h-7 w-7 text-orangebrand" />
          <p className="mt-5 text-sm font-bold text-ink/50">Capacity Sold</p>
          <p className="mt-1 text-2xl font-black">
            {totalCapacity > 0 ? `${((totalTicketsSold / totalCapacity) * 100).toFixed(0)}%` : "0%"}
          </p>
        </div>
      </div>

      {/* Events Table / Grid */}
      <div className="rounded-[2rem] bg-white p-6 shadow-card border border-slate-100">
        <h2 className="text-xl font-black text-ink mb-4">Your Live Events</h2>
        {events.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Ticket className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-base font-semibold">No events created yet</p>
            <p className="text-sm mt-1">Get started by clicking the &quot;Create Event&quot; button above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 font-bold text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Event Details</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Ticket Price</th>
                  <th className="py-3 px-4">Tickets Sold</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {events.map((event) => (
                  <tr key={event._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-4">
                      <p className="font-black text-ink text-base">{event.title}</p>
                      <p className="text-slate-500 line-clamp-1 mt-1 text-xs">{event.description}</p>
                    </td>
                    <td className="py-4 px-4 text-slate-600 font-medium">
                      {new Date(event.date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td className="py-4 px-4 text-slate-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="line-clamp-1">{event.location}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-bold text-ink">
                      ${event.ticketPrice.toFixed(2)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1 w-24">
                        <div className="flex justify-between text-xs font-bold">
                          <span>{event.ticketsSold} sold</span>
                          <span className="text-slate-400">/{event.ticketQuantity}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orangebrand"
                            style={{ width: `${Math.min(100, (event.ticketsSold / event.ticketQuantity) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditForm(event)}
                          className="p-2 hover:bg-orangebrand/10 text-slate-600 hover:text-orangebrand rounded-full transition"
                          title="Edit Event"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => event._id && handleDelete(event._id)}
                          className="p-2 hover:bg-coral/10 text-slate-600 hover:text-coral rounded-full transition"
                          title="Delete Event"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modular Event Creation / Edit Modal Dialog Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-glow border border-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute right-6 top-6 p-1.5 text-slate-400 hover:text-ink hover:bg-slate-100 rounded-full transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-2xl font-black text-ink mb-1">
              {editingEvent ? "Edit Live Event" : "Create New Event"}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {editingEvent ? "Update your live event details below." : "Enter the details to announce your brand new live event."}
            </p>

            <form onSubmit={handleSubmit} className="grid gap-4">
              <Field label="Event Title">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. BooqDat Summer Jam 2026"
                  required
                />
              </Field>

              <Field label="Description">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your event, headliners, special policies..."
                  required
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date & Time">
                  <Input
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </Field>

                <Field label="Ticket Price ($)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ticketPrice}
                    onChange={(e) => setTicketPrice(e.target.value)}
                    placeholder="e.g. 49.99"
                    required
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ticket Quantity / Capacity">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={ticketQuantity}
                    onChange={(e) => setTicketQuantity(e.target.value)}
                    placeholder="e.g. 500"
                    required
                  />
                </Field>

                <Field label="Venue Location">
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Madison Square Garden, NY"
                    required
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Latitude (Optional)" hint="For Map search & sorting">
                  <Input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 40.7505"
                  />
                </Field>

                <Field label="Longitude (Optional)" hint="For Map search & sorting">
                  <Input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. -73.9934"
                  />
                </Field>
              </div>

              {error && (
                <p className="rounded-2xl bg-coral/10 p-3 text-sm font-semibold text-coral">{error}</p>
              )}

              <div className="flex gap-3 justify-end mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsFormOpen(false)}
                  disabled={loading}
                  className="rounded-full px-5 py-2.5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="rounded-full px-6 py-2.5"
                >
                  {loading ? "Saving..." : editingEvent ? "Save Changes" : "Publish Event"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
