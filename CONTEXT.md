# Fiverr Service Marketplace

A marketplace where clients discover services offered by sellers, hire them, and manage the resulting engagements.

## Language

**Service**:
A listing offered by a seller that a client can discover and hire.
_Avoid_: Job, Gig, Công việc

**Service Category**:
A top-level classification used to organize related services.
_Avoid_: Job Category, Loại công việc

**Service Group**:
A presentation grouping nested within a service category that organizes related service subcategories; it is not a selectable service classification by itself.
_Avoid_: Detail Category Group, Nhóm chi tiết loại

**Service Subcategory**:
A selectable leaf classification nested within a service group that clients use to narrow service discovery.
_Avoid_: Job Detail Category, Chi tiết loại công việc

**User**:
The single account identity in the marketplace; the same user may act as a client, a seller, or both.
_Avoid_: Account, Member

**Visitor**:
A person using the marketplace without an authenticated User session; a visitor may browse public service content but must sign in before performing authenticated actions.
_Avoid_: Guest

**Seller**:
A contextual role a user takes when they own and offer a service; it is not a separate account type.
_Avoid_: Freelancer, Creator, Provider

**Client**:
A contextual role a user takes when they discover or hire a service; it is not a separate account type.
_Avoid_: Customer, Buyer, Account

**Administrator**:
A privileged user who manages users, services, service categories, service subcategories, comments, and hired services.

**Comment**:
Feedback a user posts on a service, consisting of written content and a rating.
_Avoid_: Review, Bình luận

**Hire**:
The act that creates an engagement between a client and a service.
_Avoid_: Checkout, Purchase, Payment, Order

**Hired Service**:
A service that a client has hired and can later mark as completed or cancel.
_Avoid_: Order, Booking, Purchased Service
