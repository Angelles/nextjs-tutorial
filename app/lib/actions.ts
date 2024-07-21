'use server'; // Server Actions

// validate form data
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

 
const FormSchema = z.object({
  id: z.string({
    required_error: 'Please select a customer.',
  }),
  customerId: z.string(),
  amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    required_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
      });
       // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Create Invoice.',
      };
    }

    // Prepare data for db insertion
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100; // avoid floating-point errors
    const date = new Date().toISOString().split('T')[0]; // invoice creation date in MM-DD-YYYY format
      
  try {
      await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  }
  catch (error){
    return{
      message: 'Database Error: Failure to create invoice',
    };
  }
  revalidatePath('/dashboard/invoices'); // clear cache and trigger request to the server
  redirect('/dashboard/invoices'); // redirect user back to the invoices page
}

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
 
// ...
 
export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
 
  const amountInCents = amount * 100;
 
  try{
  await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
 
} catch (error){
  return {
    message: 'Database Error: Unable to update invoice',
  };
}
revalidatePath('/dashboard/invoices');
redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try{
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath('/dashboard/invoices');
  } catch (error){
    return{
      message: 'Database Error: Unable to delete invoice',
    };
  }
}